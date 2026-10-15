/**
 * DATOS DE DEMOSTRACIÓN. Almacén ficticio de alimentación y envases:
 * quesos, salmón, piñas y recipientes de plástico, cada uno con condiciones de conservación distintas.
 */
import { newId, nowIso } from './ids'
import { buildLocations, zonesLayout } from './layout'
import * as ops from './operations'
import type { Product, StockEntry, WarehouseState } from './types'

export const STATE_VERSION = 4

type SeedProduct = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'unit' | 'barcode'> & { barcode?: string; unit?: string }

const P = (sku: string, name: string, category: string, extra: Partial<SeedProduct> & Pick<SeedProduct, 'temperature' | 'form' | 'size' | 'weightKg' | 'volumeM3' | 'minStock' | 'rotation'>): SeedProduct => ({
  sku, name, category, special: 'ninguno', imageUrl: `img/${category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s.*/, '')}.svg`, ...extra,
})

export const demoProducts: SeedProduct[] = [
  // Quesos: refrigerado 0-4 °C, ruedas y cuñas en cajas
  P('QUE-MAN-001', 'Queso manchego curado rueda 3 kg', 'Quesos', { temperature: 'refrigerado', form: 'caja', size: 'M', weightKg: 3.2, volumeM3: 0.006, minStock: 40, rotation: 'alta', special: 'perecedero', lot: 'L24-0912', expiryDate: '2027-03-15' }),
  P('QUE-MAN-002', 'Queso manchego semicurado cuña 250 g', 'Quesos', { temperature: 'refrigerado', form: 'caja', size: 'S', weightKg: 0.25, volumeM3: 0.0004, minStock: 120, rotation: 'alta', special: 'perecedero', lot: 'L25-0104', expiryDate: '2026-12-20' }),
  P('QUE-BRI-003', 'Queso brie 1 kg', 'Quesos', { temperature: 'refrigerado', form: 'caja', size: 'S', weightKg: 1, volumeM3: 0.0012, minStock: 30, rotation: 'media', special: 'perecedero', expiryDate: '2026-11-30' }),
  P('QUE-CAB-004', 'Queso de cabra rulo 180 g', 'Quesos', { temperature: 'refrigerado', form: 'bandeja', size: 'S', weightKg: 0.18, volumeM3: 0.0003, minStock: 80, rotation: 'media', special: 'perecedero', expiryDate: '2026-11-25' }),
  P('QUE-AZU-005', 'Queso azul Cabrales 500 g', 'Quesos', { temperature: 'refrigerado', form: 'caja', size: 'S', weightKg: 0.5, volumeM3: 0.0007, minStock: 25, rotation: 'baja', special: 'perecedero', expiryDate: '2026-12-05' }),
  P('QUE-PAR-006', 'Queso parmesano rueda 38 kg', 'Quesos', { temperature: 'refrigerado', form: 'palet', size: 'L', weightKg: 38, volumeM3: 0.05, minStock: 4, rotation: 'baja', special: 'perecedero' }),
  P('QUE-GOU-007', 'Queso gouda bola 4,5 kg', 'Quesos', { temperature: 'refrigerado', form: 'caja', size: 'M', weightKg: 4.5, volumeM3: 0.008, minStock: 20, rotation: 'media', special: 'perecedero' }),
  // Salmón: fresco refrigerado 0-4 °C y congelado -18 °C
  P('SAL-FRE-001', 'Salmón fresco entero 4-5 kg', 'Salmón', { temperature: 'refrigerado', form: 'caja', size: 'M', weightKg: 4.6, volumeM3: 0.012, minStock: 30, rotation: 'alta', special: 'perecedero', lot: 'NOR-4471', expiryDate: '2026-10-22' }),
  P('SAL-FIL-002', 'Lomo de salmón fresco 1 kg', 'Salmón', { temperature: 'refrigerado', form: 'bandeja', size: 'S', weightKg: 1, volumeM3: 0.002, minStock: 60, rotation: 'alta', special: 'perecedero', expiryDate: '2026-10-20' }),
  P('SAL-AHU-003', 'Salmón ahumado loncheado 200 g', 'Salmón', { temperature: 'refrigerado', form: 'bandeja', size: 'S', weightKg: 0.2, volumeM3: 0.0004, minStock: 150, rotation: 'alta', special: 'perecedero', expiryDate: '2026-11-10' }),
  P('SAL-CON-004', 'Salmón congelado porciones 5 kg', 'Salmón', { temperature: 'congelado', form: 'jaula', size: 'L', weightKg: 5, volumeM3: 0.009, minStock: 40, rotation: 'media', special: 'perecedero', expiryDate: '2027-06-30' }),
  P('SAL-CON-005', 'Salmón congelado entero 6 kg', 'Salmón', { temperature: 'congelado', form: 'jaula', size: 'L', weightKg: 6, volumeM3: 0.014, minStock: 20, rotation: 'baja', special: 'perecedero', expiryDate: '2027-05-31' }),
  P('SAL-HAM-006', 'Hamburguesa de salmón congelada 12 ud', 'Salmón', { temperature: 'congelado', form: 'jaula', size: 'L', weightKg: 1.2, volumeM3: 0.003, minStock: 50, rotation: 'media', special: 'perecedero', expiryDate: '2027-04-15' }),
  // Piñas: fresco 8-13 °C ventilado, jaulas y cajas
  P('PIN-GOL-001', 'Piña Golden MD2 caja 12 ud', 'Piñas', { temperature: 'fresco', form: 'caja', size: 'M', weightKg: 18, volumeM3: 0.04, minStock: 30, rotation: 'alta', special: 'perecedero', lot: 'CR-2026-41', expiryDate: '2026-10-28' }),
  P('PIN-GOL-002', 'Piña Golden MD2 palet 60 cajas', 'Piñas', { temperature: 'fresco', form: 'palet', size: 'L', weightKg: 1080, volumeM3: 1.7, minStock: 2, rotation: 'alta', special: 'perecedero', expiryDate: '2026-10-26' }),
  P('PIN-BAB-003', 'Piña baby caja 24 ud', 'Piñas', { temperature: 'fresco', form: 'caja', size: 'M', weightKg: 12, volumeM3: 0.03, minStock: 15, rotation: 'media', special: 'perecedero', expiryDate: '2026-10-30' }),
  P('PIN-COR-004', 'Piña cortada en dados 1 kg (IV gama)', 'Piñas', { temperature: 'refrigerado', form: 'bandeja', size: 'S', weightKg: 1, volumeM3: 0.0015, minStock: 40, rotation: 'alta', special: 'perecedero', expiryDate: '2026-10-19' }),
  P('PIN-SEC-005', 'Piña deshidratada bolsa 500 g', 'Piñas', { temperature: 'ambiente', form: 'caja', size: 'S', weightKg: 0.5, volumeM3: 0.001, minStock: 50, rotation: 'baja' }),
  // Recipientes de plástico: ambiente, formas rígidas de distintos tamaños (anidables, apilables, voluminosos)
  P('REC-CUB-001', 'Cubo alimentario PP 5 L con tapa', 'Recipientes de plástico', { temperature: 'ambiente', form: 'caja', size: 'M', weightKg: 0.3, volumeM3: 0.006, minStock: 200, rotation: 'alta' }),
  P('REC-CUB-002', 'Cubo alimentario PP 20 L con tapa', 'Recipientes de plástico', { temperature: 'ambiente', form: 'caja', size: 'L', weightKg: 0.9, volumeM3: 0.025, minStock: 80, rotation: 'media', special: 'voluminoso' }),
  P('REC-BID-003', 'Bidón HDPE 60 L boca ancha', 'Recipientes de plástico', { temperature: 'ambiente', form: 'bidon', size: 'L', weightKg: 3.5, volumeM3: 0.08, minStock: 20, rotation: 'media', special: 'voluminoso' }),
  P('REC-BID-004', 'Bidón HDPE 220 L', 'Recipientes de plástico', { temperature: 'ambiente', form: 'bidon', size: 'L', weightKg: 9.5, volumeM3: 0.3, minStock: 6, rotation: 'baja', special: 'voluminoso' }),
  P('REC-CAJ-005', 'Caja eurobox 60x40x32 cm', 'Recipientes de plástico', { temperature: 'ambiente', form: 'caja', size: 'L', weightKg: 2.1, volumeM3: 0.077, minStock: 60, rotation: 'alta', special: 'voluminoso' }),
  P('REC-CAJ-006', 'Caja agrícola calada 50x30x25 cm', 'Recipientes de plástico', { temperature: 'ambiente', form: 'caja', size: 'M', weightKg: 1.2, volumeM3: 0.0375, minStock: 100, rotation: 'alta' }),
  P('REC-TAR-007', 'Tarrina PP 500 ml (1000 ud)', 'Recipientes de plástico', { temperature: 'ambiente', form: 'caja', size: 'M', weightKg: 11, volumeM3: 0.09, minStock: 15, rotation: 'alta' }),
  P('REC-TAR-008', 'Tarrina PP 250 ml (1500 ud)', 'Recipientes de plástico', { temperature: 'ambiente', form: 'caja', size: 'M', weightKg: 10, volumeM3: 0.08, minStock: 15, rotation: 'media' }),
  P('REC-BOT-009', 'Botella PET 1 L (500 ud)', 'Recipientes de plástico', { temperature: 'ambiente', form: 'caja', size: 'M', weightKg: 14, volumeM3: 0.3, minStock: 10, rotation: 'baja' }),
  P('REC-GAR-010', 'Garrafa HDPE 5 L (120 ud)', 'Recipientes de plástico', { temperature: 'ambiente', form: 'caja', size: 'L', weightKg: 12, volumeM3: 0.25, minStock: 8, rotation: 'media', special: 'voluminoso' }),
  P('REC-BAN-011', 'Bandeja PET termosellable (500 ud)', 'Recipientes de plástico', { temperature: 'ambiente', form: 'caja', size: 'M', weightKg: 9, volumeM3: 0.06, minStock: 25, rotation: 'alta' }),
  P('REC-TAP-012', 'Tapa para cubo 20 L (200 ud)', 'Recipientes de plástico', { temperature: 'ambiente', form: 'caja', size: 'S', weightKg: 8, volumeM3: 0.03, minStock: 10, rotation: 'baja' }),
  P('REC-PAL-013', 'Palet de plástico higiénico 1200x800', 'Recipientes de plástico', { temperature: 'ambiente', form: 'palet', size: 'L', weightKg: 16, volumeM3: 0.15, minStock: 12, rotation: 'baja', special: 'voluminoso' }),
  P('REC-JAU-014', 'Jaula plegable 1000 L (contenedor IBC)', 'Recipientes de plástico', { temperature: 'ambiente', form: 'jaula', size: 'L', weightKg: 55, volumeM3: 1.2, minStock: 3, rotation: 'baja', special: 'voluminoso' }),
]

function barcodeFor(i: number) {
  return `84120${String(1000 + i * 37).padStart(5, '0')}${String((i * 7919) % 1000).padStart(3, '0')}`
}

export function emptyState(): WarehouseState {
  const ts = nowIso()
  const zones = Object.fromEntries(zonesLayout.map((z) => [z.id, z]))
  const locations = Object.fromEntries(buildLocations().map((l) => [l.id, l]))
  return {
    version: STATE_VERSION,
    demo: false,
    products: {}, zones, locations, stock: {}, orders: {}, receipts: {}, shipments: {}, transfers: {}, returns: {}, movements: {},
    settings: { warehouseName: 'BETO S.L. · Centro logístico', currentUser: 'Operario demo', defaultRequiresQc: true, autoReserve: true, demoDataLabel: 'Datos de demostración' },
    counters: {},
    updatedAt: ts,
  }
}

/** Reparte unidades iniciales en ubicaciones compatibles con el producto (temperatura, tamaño). */
function initialPlacements(state: WarehouseState, p: Product, idx: number): { locationId: string; qty: number }[] {
  const locs = Object.values(state.locations)
    .filter((l) => l.kind === 'estanteria' && ['Z-A', 'Z-B', 'Z-C', 'Z-D'].includes(l.zoneId) || l.zoneId === 'Z-CNG' || l.zoneId === 'Z-PCK')
    .filter((l) => !ops.checkCanReceive(state, l.id, p.id, 1))
  // Alta rotación: cerca del picking (pasillos bajos); baja rotación: pasillos altos / niveles altos
  const sorted = locs.sort((a, b) => {
    const score = (l: typeof a) => {
      let s = l.aisle * 10 + l.level
      if (p.rotation === 'alta') s = l.zoneId === 'Z-PCK' ? -100 + l.module : s
      if (p.rotation === 'baja') s = 100 - l.aisle * 10 + (5 - l.level)
      return s
    }
    return score(a) - score(b)
  })
  const result: { locationId: string; qty: number }[] = []
  const used = new Set<string>()
  const base = p.rotation === 'alta' ? 3 : p.rotation === 'media' ? 2 : 1
  let remaining = Math.round((p.minStock * (idx % 5 === 0 ? 0.6 : 2.3 + (idx % 3) * 0.6)))
  if (p.size === 'L') remaining = Math.max(remaining, 6)
  let cursor = (idx * 7) % Math.max(1, sorted.length - 1)
  for (let k = 0; k < base + 2 && remaining > 0; k++) {
    const loc = sorted[(cursor + k * 3) % sorted.length]
    if (!loc || used.has(loc.id)) continue
    used.add(loc.id)
    const occ = Object.values(state.stock).filter((s) => s.locationId === loc.id).reduce((a, s) => a + s.quantity, 0)
    const free = loc.capacity - occ
    if (free <= 0) continue
    const fill = k === 0 && idx % 4 === 1 ? free : Math.min(free, Math.ceil(remaining / (base + 1 - k)))
    const qty = Math.max(1, Math.min(free, fill, remaining))
    result.push({ locationId: loc.id, qty })
    remaining -= qty
  }
  return result
}

export function buildDemoState(): WarehouseState {
  let state = emptyState()
  state.demo = true
  const ts = nowIso()
  demoProducts.forEach((sp, i) => {
    const id = `prd_demo_${String(i + 1).padStart(3, '0')}`
    state.products[id] = { ...sp, id, barcode: sp.barcode ?? barcodeFor(i + 1), unit: sp.unit ?? 'ud', status: 'activo', createdAt: ts, updatedAt: ts }
  })
  // Stock inicial
  Object.values(state.products).forEach((p, idx) => {
    for (const pl of initialPlacements(state, p, idx)) {
      const sid = newId('stk')
      const entry: StockEntry = { id: sid, locationId: pl.locationId, productId: p.id, quantity: pl.qty, state: 'disponible', lot: p.lot }
      state.stock[sid] = entry
      const mid = newId('mov')
      state.movements[mid] = { id: mid, timestamp: ts, type: 'entrada', productId: p.id, sku: p.sku, quantity: pl.qty, toLocationId: pl.locationId, reference: 'INV-INICIAL', user: 'Sistema', result: 'ok', notes: 'Inventario inicial (datos de demostración)' }
    }
  })
  const ids = Object.keys(state.products)
  const bySku = (sku: string) => Object.values(state.products).find((p) => p.sku === sku)!.id
  const locBy = (code: string) => `L-${code}`

  // Ubicación bloqueada de ejemplo
  state = ops.blockLocation(state, locBy('B-03-05-02'), 'Estantería dañada: pendiente de reparación', 'Jefe de almacén')
  state = ops.blockLocation(state, locBy('A-02-08-04'), 'Inventario en curso', 'Jefe de almacén')

  // Recepciones de ejemplo
  state = ops.createReceipt(state, { supplier: 'Quesería La Mancha S.L.', documentRef: 'ALB-2026-1187', date: ts.slice(0, 10), requiresQc: true, lines: [{ productId: bySku('QUE-MAN-001'), quantityExpected: 40 }, { productId: bySku('QUE-MAN-002'), quantityExpected: 120 }] })
  state = ops.createReceipt(state, { supplier: 'Nordic Salmon AS', documentRef: 'ALB-NS-5520', date: ts.slice(0, 10), requiresQc: true, lines: [{ productId: bySku('SAL-FRE-001'), quantityExpected: 30 }, { productId: bySku('SAL-FIL-002'), quantityExpected: 60 }] })
  state = ops.createReceipt(state, { supplier: 'Envases Plásticos Levante S.A.', documentRef: 'ALB-PL-0921', date: ts.slice(0, 10), requiresQc: false, lines: [{ productId: bySku('REC-CAJ-006'), quantityExpected: 100 }, { productId: bySku('REC-BAN-011'), quantityExpected: 20 }] })
  // Una recepción completada
  state = ops.createReceipt(state, { supplier: 'Tropical Fruits Costa Rica', documentRef: 'ALB-TF-3302', date: ts.slice(0, 10), requiresQc: false, lines: [{ productId: bySku('PIN-GOL-001'), quantityExpected: 40 }] })
  const recDone = Object.values(state.receipts).find((r) => r.supplier.startsWith('Tropical'))!
  state = ops.startReceiving(state, recDone.id)
  state = ops.recordReceiptLine(state, recDone.id, recDone.lines[0].id, { quantityReceived: 40, quantityDamaged: 2, destinationLocationId: locBy('C-05-01-01') })
  state = ops.confirmReceipt(state, recDone.id, 'Recepcionista')

  // Pedidos
  state = ops.createOrder(state, { customer: 'Supermercados Norte', priority: 'alta', lines: [{ productId: bySku('QUE-MAN-002'), quantity: 48 }, { productId: bySku('SAL-AHU-003'), quantity: 60 }, { productId: bySku('PIN-COR-004'), quantity: 24 }] })
  state = ops.createOrder(state, { customer: 'Restaurante Marisol', priority: 'normal', lines: [{ productId: bySku('SAL-FRE-001'), quantity: 6 }, { productId: bySku('QUE-BRI-003'), quantity: 10 }] })
  state = ops.createOrder(state, { customer: 'Envasados Ibéricos S.L.', priority: 'urgente', lines: [{ productId: bySku('REC-TAR-007'), quantity: 12 }, { productId: bySku('REC-CAJ-006'), quantity: 40 }, { productId: bySku('REC-CUB-001'), quantity: 100 }] })
  state = ops.createOrder(state, { customer: 'Hotel Costa Azul', priority: 'baja', lines: [{ productId: bySku('PIN-GOL-001'), quantity: 10 }, { productId: bySku('QUE-GOU-007'), quantity: 8 }] })
  // Pedido preparado y enviado
  state = ops.createOrder(state, { customer: 'Catering Delicias', priority: 'normal', lines: [{ productId: bySku('SAL-AHU-003'), quantity: 30 }, { productId: bySku('QUE-CAB-004'), quantity: 20 }] })
  const sent = Object.values(state.orders).find((o) => o.customer === 'Catering Delicias')!
  state = ops.startPicking(state, sent.id)
  state = ops.pickAll(state, sent.id, 'Preparador 2')
  state = ops.createShipment(state, { orderIds: [sent.id], recipient: 'Catering Delicias · Madrid', carrier: 'SEUR Frío', trackingRef: 'SF-77812034', notes: 'Cadena de frío 0-4 °C' })
  const shp = Object.values(state.shipments)[0]
  state = ops.confirmShipment(state, shp.id, 'Expedidor 1')
  // Pedido en preparación parcial
  const partial = Object.values(state.orders).find((o) => o.customer === 'Supermercados Norte')!
  state = ops.startPicking(state, partial.id)
  const l0 = partial.lines[0]
  const r0 = state.orders[partial.id].lines[0].reservations[0]
  if (r0) state = ops.confirmPick(state, partial.id, l0.id, r0.locationId, Math.min(r0.quantity, 24), 'Preparador 1')

  // Transferencias históricas
  const t1 = Object.values(state.stock).find((s) => state.products[s.productId].sku === 'REC-CUB-001' && s.state === 'disponible')
  if (t1) state = ops.transferStock(state, { productId: t1.productId, fromLocationId: t1.locationId, toLocationId: locBy('PCK-01-03-01'), quantity: Math.min(10, t1.quantity), reason: 'Reposición de picking', user: 'Carretillero 1' })
  const t2 = Object.values(state.stock).find((s) => state.products[s.productId].sku === 'REC-CUB-002' && s.state === 'disponible' && s.quantity > 5)
  if (t2) state = ops.transferStock(state, { productId: t2.productId, fromLocationId: t2.locationId, toLocationId: locBy('B-04-01-01'), quantity: 5, reason: 'Consolidación de hueco', user: 'Carretillero 2' })

  // Devoluciones
  state = ops.createReturn(state, { orderId: sent.id, productId: bySku('SAL-AHU-003'), quantity: 4, reason: 'Envase hinchado', packagingState: 'danado', user: 'Atención al cliente' })
  state = ops.createReturn(state, { orderId: sent.id, productId: bySku('QUE-CAB-004'), quantity: 3, reason: 'Pedido duplicado por el cliente', packagingState: 'intacto', user: 'Atención al cliente' })
  const retOk = Object.values(state.returns).find((r) => r.reason.startsWith('Pedido duplicado'))!
  const retDest = Object.values(state.locations).find((l) => l.zoneId === 'Z-D' && !ops.checkCanReceive(state, l.id, retOk.productId, retOk.quantity))!
  state = ops.inspectReturn(state, retOk.id, 'apta', 'Precinto intacto, temperatura correcta', retDest.id, 'Inspector calidad')

  // Ajuste documentado
  const adj = Object.values(state.stock).find((s) => state.products[s.productId].sku === 'REC-TAP-012')
  if (adj) state = ops.adjustStock(state, adj.locationId, adj.productId, -2, 'Recuento cíclico: 2 unidades rotas', 'Jefe de almacén')

  return backdate(state, ids.length)
}

/** Reparte las fechas de los movimientos y documentos de ejemplo en los últimos 20 días para los informes. */
function backdate(state: WarehouseState, _n: number): WarehouseState {
  const movs = Object.values(state.movements).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const now = Date.now()
  const span = 20 * 86400000
  movs.forEach((m, i) => {
    const frac = i / Math.max(1, movs.length - 1)
    const jitter = ((i * 7919) % 3600) * 1000
    const t = new Date(now - span + frac * span * 0.97 - jitter)
    m.timestamp = t.toISOString()
    if (m.reference === 'INV-INICIAL') m.timestamp = new Date(now - span - 86400000 + i * 60000).toISOString()
  })
  const shift = (iso: string, days: number) => new Date(new Date(iso).getTime() - days * 86400000).toISOString()
  Object.values(state.receipts).forEach((r, i) => { r.createdAt = shift(r.createdAt, 1 + i); r.date = r.createdAt.slice(0, 10); if (r.confirmedAt) r.confirmedAt = shift(r.confirmedAt, 1 + i) })
  Object.values(state.orders).forEach((o, i) => { o.createdAt = shift(o.createdAt, i * 0.5); o.date = o.createdAt.slice(0, 10) })
  Object.values(state.transfers).forEach((t, i) => { t.createdAt = shift(t.createdAt, 2 + i) })
  Object.values(state.returns).forEach((r, i) => { r.createdAt = shift(r.createdAt, 0.3 + i) })
  Object.values(state.shipments).forEach((s) => { s.createdAt = shift(s.createdAt, 1); if (s.confirmedAt) s.confirmedAt = shift(s.confirmedAt, 0.9) })
  return state
}
