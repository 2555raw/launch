import { describe, expect, it } from 'vitest'
import { buildDemoState, emptyState } from './seed'
import * as ops from './operations'
import { DomainError } from './errors'
import { availableAt, integrityIssues, occupiedAt, productStock, stockEntriesAt, values } from './queries'
import { AUX_LOCATION_ID, RETURNS_LOCATION_ID, STAGING_LOCATION_ID } from './layout'
import type { WarehouseState } from './types'

const baseProduct = { sku: 'TEST-001', name: 'Producto de prueba', category: 'Quesos', minStock: 10, weightKg: 1, volumeM3: 0.001, rotation: 'alta' as const, special: 'ninguno' as const, temperature: 'ambiente' as const, form: 'caja' as const, size: 'S' as const }

function fresh(): { s: WarehouseState; pid: string } {
  let s = emptyState()
  s = ops.createProduct(s, baseProduct, { locationId: 'L-A-01-02-01', quantity: 100 })
  const pid = values(s.products)[0].id
  return { s, pid }
}

describe('productos e inventario', () => {
  it('1. crea un producto y lo encuentra en inventario; 2. lo asigna a una ubicación', () => {
    const { s, pid } = fresh()
    expect(s.products[pid].sku).toBe('TEST-001')
    expect(productStock(s, pid).total).toBe(100)
    expect(stockEntriesAt(s, 'L-A-01-02-01')[0].quantity).toBe(100)
    expect(values(s.movements).some((m) => m.type === 'entrada' && m.quantity === 100)).toBe(true)
  })
  it('rechaza SKU duplicado y cantidades negativas', () => {
    const { s } = fresh()
    expect(() => ops.createProduct(s, baseProduct)).toThrow(DomainError)
    expect(() => ops.createProduct(s, { ...baseProduct, sku: 'X-2', minStock: -1 })).toThrow(/mínimo/)
    expect(() => ops.adjustStock(s, 'L-A-01-02-01', values(s.products)[0].id, -200, 'prueba')).toThrow(/insuficiente/)
  })
})

describe('transferencias', () => {
  it('3/4. mueve 30 de 100: origen 70, destino +30, una única operación lógica', () => {
    const { s, pid } = fresh()
    const r = ops.transferStock(s, { productId: pid, fromLocationId: 'L-A-01-02-01', toLocationId: 'L-B-03-02-01', quantity: 30 })
    expect(occupiedAt(r, 'L-A-01-02-01')).toBe(70)
    expect(occupiedAt(r, 'L-B-03-02-01')).toBe(30)
    expect(productStock(r, pid).total).toBe(100)
    expect(values(r.transfers)).toHaveLength(1)
    expect(values(r.movements).filter((m) => m.type === 'transferencia')).toHaveLength(1)
    // El estado original no se modifica (inmutabilidad / atomicidad)
    expect(occupiedAt(s, 'L-A-01-02-01')).toBe(100)
  })
  it('5. no permite mover más de lo disponible', () => {
    const { s, pid } = fresh()
    expect(() => ops.transferStock(s, { productId: pid, fromLocationId: 'L-A-01-02-01', toLocationId: 'L-B-03-02-01', quantity: 101 })).toThrow(/insuficiente/)
    expect(() => ops.transferStock(s, { productId: pid, fromLocationId: 'L-A-01-02-01', toLocationId: 'L-B-03-02-01', quantity: 0 })).toThrow(/mayor que cero/)
  })
  it('6. no permite superar la capacidad del destino', () => {
    const { s: s0, pid } = fresh()
    const cap = s0.locations['L-A-01-04-04'].capacity
    const s = ops.adjustStock(s0, 'L-A-01-04-04', pid, cap - 20, 'Preparar prueba de capacidad')
    expect(ops.checkCanReceive(s, 'L-A-01-04-04', pid, 21)).toMatch(/Capacidad insuficiente/)
    expect(() => ops.transferStock(s, { productId: pid, fromLocationId: 'L-A-01-02-01', toLocationId: 'L-A-01-04-04', quantity: 21 })).toThrow(/Capacidad insuficiente/)
    const ok = ops.transferStock(s, { productId: pid, fromLocationId: 'L-A-01-02-01', toLocationId: 'L-A-01-04-04', quantity: 20 })
    expect(occupiedAt(ok, 'L-A-01-04-04')).toBe(cap)
    expect(integrityIssues(ok)).toEqual([])
  })
  it('7. rechaza ubicaciones bloqueadas como destino', () => {
    const { s, pid } = fresh()
    const b = ops.blockLocation(s, 'L-B-03-02-01', 'Mantenimiento')
    expect(() => ops.transferStock(b, { productId: pid, fromLocationId: 'L-A-01-02-01', toLocationId: 'L-B-03-02-01', quantity: 5 })).toThrow(/bloqueada/)
    expect(ops.checkCanReceive(b, 'L-B-03-02-01', pid, 1)).toMatch(/bloqueada/)
    const u = ops.unblockLocation(b, 'L-B-03-02-01')
    expect(ops.checkCanReceive(u, 'L-B-03-02-01', pid, 1)).toBeNull()
  })
  it('respeta temperatura y tamaño del producto', () => {
    let s = emptyState()
    s = ops.createProduct(s, { ...baseProduct, sku: 'FRIO-1', temperature: 'refrigerado', size: 'L' })
    const pid = values(s.products)[0].id
    expect(ops.checkCanReceive(s, 'L-A-01-01-01', pid, 1)).toMatch(/Temperatura/)
    expect(ops.checkCanReceive(s, 'L-D-06-01-02', pid, 1)).toMatch(/Tamaño/)
    expect(ops.checkCanReceive(s, 'L-D-06-01-01', pid, 1)).toBeNull()
  })
})

describe('recepciones', () => {
  it('8. recibir mercancía actualiza el inventario solo al confirmar; con calidad pasa por cuarentena', () => {
    const { s, pid } = fresh()
    let r = ops.createReceipt(s, { supplier: 'Prov', documentRef: 'ALB-1', date: '2026-10-15', requiresQc: true, lines: [{ productId: pid, quantityExpected: 50 }] })
    const rec = values(r.receipts)[0]
    expect(productStock(r, pid).total).toBe(100)
    r = ops.startReceiving(r, rec.id)
    r = ops.recordReceiptLine(r, rec.id, rec.lines[0].id, { quantityReceived: 48, quantityDamaged: 3, destinationLocationId: 'L-A-01-03-01' })
    expect(() => ops.confirmReceipt(r, rec.id)).toThrow(/calidad/)
    r = ops.sendReceiptToQc(r, rec.id)
    expect(productStock(r, pid).quarantine).toBe(45)
    expect(productStock(r, pid).available).toBe(100)
    expect(() => ops.confirmReceipt(r, rec.id)).toThrow(/resultado de calidad/)
    r = ops.resolveQc(r, rec.id, rec.lines[0].id, 'aprobado')
    r = ops.confirmReceipt(r, rec.id)
    expect(productStock(r, pid).available).toBe(145)
    expect(productStock(r, pid).damaged).toBe(3)
    expect(occupiedAt(r, AUX_LOCATION_ID)).toBe(3)
    expect(r.receipts[rec.id].status).toBe('incidencia')
    // Idempotencia: no se puede confirmar dos veces
    expect(() => ops.confirmReceipt(r, rec.id)).toThrow(DomainError)
  })
})

describe('pedidos, picking y expedición', () => {
  it('9. dos pedidos no pueden reservar las mismas unidades', () => {
    const { s, pid } = fresh()
    let r = ops.createOrder(s, { customer: 'A', priority: 'normal', lines: [{ productId: pid, quantity: 80 }] })
    r = ops.createOrder(r, { customer: 'B', priority: 'normal', lines: [{ productId: pid, quantity: 50 }] })
    const [o1, o2] = values(r.orders)
    expect(o1.lines[0].quantityReserved).toBe(80)
    expect(o2.lines[0].quantityReserved).toBe(20)
    expect(productStock(r, pid).reserved).toBe(100)
    expect(productStock(r, pid).available).toBe(0)
    expect(availableAt(r, 'L-A-01-02-01', pid)).toBe(0)
    // Tampoco se puede transferir stock reservado
    expect(() => ops.transferStock(r, { productId: pid, fromLocationId: 'L-A-01-02-01', toLocationId: 'L-B-03-02-01', quantity: 1 })).toThrow(/reservado/)
    expect(integrityIssues(r)).toEqual([])
  })
  it('10. preparar y expedir descuenta una sola vez; la expedición es idempotente', () => {
    const { s, pid } = fresh()
    let r = ops.createOrder(s, { customer: 'A', priority: 'normal', lines: [{ productId: pid, quantity: 30 }] })
    const o = values(r.orders)[0]
    r = ops.startPicking(r, o.id)
    expect(() => ops.confirmPick(r, o.id, o.lines[0].id, 'L-A-01-02-01', 31)).toThrow(/quedan/)
    r = ops.confirmPick(r, o.id, o.lines[0].id, 'L-A-01-02-01', 10)
    expect(r.orders[o.id].status).toBe('parcialmente_preparado')
    r = ops.confirmPick(r, o.id, o.lines[0].id, 'L-A-01-02-01', 20)
    expect(r.orders[o.id].status).toBe('preparado')
    expect(occupiedAt(r, 'L-A-01-02-01')).toBe(70)
    expect(occupiedAt(r, STAGING_LOCATION_ID)).toBe(30)
    expect(productStock(r, pid).total).toBe(100)
    expect(productStock(r, pid).available).toBe(70)
    r = ops.createShipment(r, { orderIds: [o.id], recipient: 'Cliente A', carrier: 'DHL', trackingRef: 'X1' })
    const sh = values(r.shipments)[0]
    expect(r.orders[o.id].status).toBe('en_expedicion')
    r = ops.confirmShipment(r, sh.id)
    expect(productStock(r, pid).total).toBe(70)
    expect(r.orders[o.id].status).toBe('enviado')
    expect(() => ops.confirmShipment(r, sh.id)).toThrow(/ya fue confirmada/)
    expect(productStock(r, pid).total).toBe(70)
    expect(values(r.movements).filter((m) => m.type === 'salida')).toHaveLength(1)
  })
  it('11. cancelar un pedido libera las reservas (y devuelve lo recogido al origen)', () => {
    const { s, pid } = fresh()
    let r = ops.createOrder(s, { customer: 'A', priority: 'normal', lines: [{ productId: pid, quantity: 40 }] })
    const o = values(r.orders)[0]
    expect(productStock(r, pid).available).toBe(60)
    r = ops.confirmPick(r, o.id, o.lines[0].id, 'L-A-01-02-01', 15)
    r = ops.cancelOrder(r, o.id, 'Cliente anula')
    expect(r.orders[o.id].status).toBe('cancelado')
    expect(productStock(r, pid).available).toBe(100)
    expect(occupiedAt(r, 'L-A-01-02-01')).toBe(100)
    expect(occupiedAt(r, STAGING_LOCATION_ID)).toBe(0)
    expect(values(r.movements).some((m) => m.type === 'liberacion')).toBe(true)
  })
  it('indica faltantes cuando no hay stock suficiente y permite completar la reserva después', () => {
    const { s, pid } = fresh()
    let r = ops.createOrder(s, { customer: 'A', priority: 'normal', lines: [{ productId: pid, quantity: 130 }] })
    const o = values(r.orders)[0]
    expect(r.orders[o.id].lines[0].quantityReserved).toBe(100)
    r = ops.adjustStock(r, 'L-A-01-03-01', pid, 50, 'Entrada extra')
    r = ops.reallocateOrder(r, o.id)
    expect(r.orders[o.id].lines[0].quantityReserved).toBe(130)
  })
})

describe('devoluciones', () => {
  it('12. una devolución dañada no aumenta el stock disponible; una apta sí tras inspección', () => {
    const { s, pid } = fresh()
    let r = ops.createReturn(s, { productId: pid, quantity: 5, reason: 'Golpe', packagingState: 'danado' })
    const ret = values(r.returns)[0]
    expect(productStock(r, pid).available).toBe(100)
    expect(occupiedAt(r, RETURNS_LOCATION_ID)).toBe(5)
    r = ops.inspectReturn(r, ret.id, 'danada', 'Rotura')
    expect(productStock(r, pid).available).toBe(100)
    expect(productStock(r, pid).damaged).toBe(5)
    expect(r.returns[ret.id].status).toBe('cerrada')
    let r2 = ops.createReturn(s, { productId: pid, quantity: 5, reason: 'No lo quiere', packagingState: 'intacto' })
    const ret2 = values(r2.returns)[0]
    r2 = ops.inspectReturn(r2, ret2.id, 'apta', 'OK', 'L-A-01-02-01')
    expect(productStock(r2, pid).available).toBe(105)
  })
})

describe('datos de demostración y trazabilidad', () => {
  it('14/15. el almacén de ejemplo es coherente y cada operación aparece en el historial', () => {
    const s = buildDemoState()
    expect(values(s.products).length).toBeGreaterThanOrEqual(25)
    expect(values(s.locations).length).toBeGreaterThan(200)
    expect(integrityIssues(s)).toEqual([])
    expect(values(s.movements).length).toBeGreaterThan(40)
    expect(values(s.receipts).length).toBeGreaterThanOrEqual(3)
    expect(values(s.orders).some((o) => o.status === 'enviado')).toBe(true)
    expect(values(s.orders).some((o) => o.status === 'pendiente')).toBe(true)
    expect(values(s.transfers).length).toBeGreaterThanOrEqual(1)
    const cats = new Set(values(s.products).map((p) => p.category))
    expect(cats.size).toBe(4)
    for (const t of values(s.transfers)) expect(values(s.movements).some((m) => m.reference === t.number)).toBe(true)
    for (const sh of values(s.shipments)) expect(values(s.movements).some((m) => m.reference === sh.number && m.type === 'salida')).toBe(true)
  })
})
