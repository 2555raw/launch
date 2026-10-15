/**
 * Operaciones de negocio. Cada operación recibe el estado y devuelve un estado nuevo.
 * Son atómicas: trabajan sobre una copia y, si una validación falla, lanzan DomainError
 * sin modificar el estado original. Nunca se edita un movimiento confirmado.
 */
import { DomainError, assert, assertQty } from './errors'
import { newId, nextNumber, nowIso } from './ids'
import { AUX_LOCATION_ID, QC_LOCATION_ID, RETURNS_LOCATION_ID, STAGING_LOCATION_ID, pickingSortKey } from './layout'
import { availableAt, isLocationStorable, occupiedAt, productStock, reservedAt, values, weightAt } from './queries'
import type {
  Location, Movement, MovementType, Order, OrderLine, OrderPriority, Product, Receipt, ReceiptLine, Return, ReturnClassification,
  Shipment, StockState, WarehouseState,
} from './types'

export const TEMP_LABEL: Record<string, string> = { ambiente: 'ambiente', fresco: 'fresco (8-13 °C)', refrigerado: 'refrigerado (0-4 °C)', congelado: 'congelado (-18 °C)' }
export const SIZE_LABEL: Record<string, string> = { S: 'pequeña (S)', M: 'mediana (M)', L: 'grande (L)' }

type Draft = WarehouseState
const clone = (s: WarehouseState): Draft => structuredClone(s)
const touch = (d: Draft) => { d.updatedAt = nowIso(); return d }

// ---------- utilidades internas ----------

function log(d: Draft, m: Omit<Movement, 'id' | 'timestamp' | 'sku'> & { sku?: string }) {
  const id = newId('mov')
  const sku = m.sku ?? (m.productId ? d.products[m.productId]?.sku ?? '' : '')
  d.movements[id] = { id, timestamp: nowIso(), ...m, sku }
  return id
}

function getLocation(d: Draft, id: string): Location {
  const loc = d.locations[id]
  assert(loc, 'LOCATION_NOT_FOUND', `La ubicación «${id}» no existe.`)
  return loc
}

function getProduct(d: Draft, id: string): Product {
  const p = d.products[id]
  assert(p, 'PRODUCT_NOT_FOUND', `El producto «${id}» no existe.`)
  return p
}

/** Comprueba que una ubicación puede recibir `qty` unidades de un producto. Devuelve el motivo si no. */
export function checkCanReceive(state: WarehouseState, locationId: string, productId: string, qty: number): string | null {
  const loc = state.locations[locationId]
  if (!loc) return 'La ubicación no existe.'
  if (loc.blocked) return `Ubicación bloqueada${loc.blockReason ? `: ${loc.blockReason}` : ''}.`
  if (!isLocationStorable(loc)) return 'Los muelles no admiten almacenamiento.'
  const occ = occupiedAt(state, loc.id)
  if (occ + qty > loc.capacity) return `Capacidad insuficiente: libres ${loc.capacity - occ} de ${loc.capacity}.`
  const p = state.products[productId]
  if (p && loc.maxWeightKg) {
    const w = weightAt(state, loc.id) + qty * p.weightKg
    if (w > loc.maxWeightKg) return `Peso máximo superado: ${w.toFixed(1)} kg de ${loc.maxWeightKg} kg.`
  }
  const zone = state.zones[loc.zoneId]
  if (p && zone) {
    const zoneTemp = zone.temperature ?? 'ambiente'
    const operational = ['recepcion', 'calidad', 'consolidacion', 'expedicion', 'devoluciones', 'auxiliar', 'picking'].includes(zone.type)
    if (!operational && zoneTemp !== p.temperature) return `Temperatura incompatible: el producto requiere ${TEMP_LABEL[p.temperature]} y la zona es ${TEMP_LABEL[zoneTemp]}.`
    const rank = { S: 1, M: 2, L: 3 }
    if (rank[p.size] > rank[loc.sizeClass]) return `Tamaño incompatible: unidad ${SIZE_LABEL[p.size]} y el hueco admite hasta ${SIZE_LABEL[loc.sizeClass]}.`
  }
  return null
}

function addStock(d: Draft, locationId: string, productId: string, qty: number, state: StockState = 'disponible', lot?: string) {
  assertQty(qty)
  const reason = checkCanReceive(d, locationId, productId, qty)
  if (reason) throw new DomainError('LOCATION_REJECTS', `${d.locations[locationId]?.code ?? locationId}: ${reason}`)
  const existing = values(d.stock).find((s) => s.locationId === locationId && s.productId === productId && s.state === state && (s.lot ?? '') === (lot ?? ''))
  if (existing) existing.quantity += qty
  else {
    const id = newId('stk')
    d.stock[id] = { id, locationId, productId, quantity: qty, state, lot }
  }
}

function removeStock(d: Draft, locationId: string, productId: string, qty: number, state: StockState = 'disponible', respectReservations = true) {
  assertQty(qty)
  const loc = getLocation(d, locationId)
  const entries = values(d.stock).filter((s) => s.locationId === locationId && s.productId === productId && s.state === state && s.quantity > 0)
  const phys = entries.reduce((a, s) => a + s.quantity, 0)
  if (respectReservations && state === 'disponible') {
    const avail = phys - reservedAt(d, locationId, productId)
    assert(avail >= qty, 'INSUFFICIENT_STOCK', `Stock insuficiente en ${loc.code}: disponible ${Math.max(0, avail)} (físico ${phys}, reservado ${phys - avail}), solicitado ${qty}.`)
  } else {
    assert(phys >= qty, 'INSUFFICIENT_STOCK', `Stock insuficiente en ${loc.code}: hay ${phys} unidades, solicitado ${qty}.`)
  }
  let remaining = qty
  for (const e of entries) {
    const take = Math.min(e.quantity, remaining)
    e.quantity -= take
    remaining -= take
    if (e.quantity === 0) delete d.stock[e.id]
    if (remaining === 0) break
  }
}

function moveStock(d: Draft, productId: string, from: string, to: string, qty: number, state: StockState = 'disponible', toState: StockState = state, respectReservations = true) {
  assert(from !== to, 'SAME_LOCATION', 'El origen y el destino no pueden ser la misma ubicación.')
  removeStock(d, from, productId, qty, state, respectReservations)
  addStock(d, to, productId, qty, toState)
}

const user = (d: Draft, u?: string) => u || d.settings.currentUser

// ---------- productos ----------

export interface ProductInput {
  sku: string
  name: string
  barcode?: string
  category: string
  imageUrl?: string
  unit?: string
  minStock: number
  weightKg: number
  volumeM3: number
  lot?: string
  expiryDate?: string
  rotation: Product['rotation']
  special: Product['special']
  temperature: Product['temperature']
  form: Product['form']
  size: Product['size']
}

function validateProductInput(d: Draft, input: ProductInput, excludeId?: string) {
  const sku = input.sku.trim().toUpperCase()
  assert(sku.length >= 2, 'SKU_INVALID', 'El SKU debe tener al menos 2 caracteres.')
  assert(/^[A-Z0-9-_.]+$/.test(sku), 'SKU_INVALID', 'El SKU solo admite letras, números, guiones y puntos.')
  const dup = values(d.products).find((p) => p.sku === sku && p.id !== excludeId)
  assert(!dup, 'SKU_DUPLICATE', `Ya existe un producto con el SKU ${sku}.`)
  if (input.barcode?.trim()) {
    const dupBc = values(d.products).find((p) => p.barcode === input.barcode!.trim() && p.id !== excludeId)
    assert(!dupBc, 'BARCODE_DUPLICATE', `El código de barras ${input.barcode} ya está asignado a ${dupBc?.sku}.`)
  }
  assert(input.name.trim().length >= 2, 'NAME_INVALID', 'El nombre del producto es obligatorio.')
  assert(Number.isInteger(input.minStock) && input.minStock >= 0, 'MIN_STOCK_INVALID', 'El stock mínimo debe ser un entero mayor o igual que cero.')
  assert(input.weightKg >= 0 && input.volumeM3 >= 0, 'MEASURE_INVALID', 'Peso y volumen no pueden ser negativos.')
  return sku
}

export function createProduct(state: WarehouseState, input: ProductInput, initial?: { locationId: string; quantity: number }): WarehouseState {
  const d = clone(state)
  const sku = validateProductInput(d, input)
  const id = newId('prd')
  const ts = nowIso()
  d.products[id] = {
    id, sku, name: input.name.trim(), barcode: input.barcode?.trim() || `84${String(Math.floor(Math.random() * 1e11)).padStart(11, '0')}`,
    category: input.category.trim() || 'General', imageUrl: input.imageUrl, unit: input.unit || 'ud', minStock: input.minStock,
    weightKg: input.weightKg, volumeM3: input.volumeM3, lot: input.lot, expiryDate: input.expiryDate, rotation: input.rotation,
    special: input.special, temperature: input.temperature, form: input.form, size: input.size, status: 'activo', createdAt: ts, updatedAt: ts,
  }
  if (initial && initial.quantity > 0) {
    addStock(d, initial.locationId, id, initial.quantity, 'disponible', input.lot)
    log(d, { type: 'entrada', productId: id, quantity: initial.quantity, toLocationId: initial.locationId, reference: 'ALTA', user: user(d), result: 'ok', notes: 'Stock inicial al crear el producto' })
  }
  return touch(d)
}

export function updateProduct(state: WarehouseState, id: string, input: ProductInput): WarehouseState {
  const d = clone(state)
  const p = getProduct(d, id)
  const sku = validateProductInput(d, input, id)
  Object.assign(p, { ...input, sku, name: input.name.trim(), updatedAt: nowIso() })
  return touch(d)
}

export function archiveProduct(state: WarehouseState, id: string): WarehouseState {
  const d = clone(state)
  const p = getProduct(d, id)
  const s = productStock(d, id)
  assert(s.total === 0, 'PRODUCT_HAS_STOCK', `No se puede archivar ${p.sku}: aún tiene ${s.total} unidades en el almacén.`)
  assert(s.reserved === 0, 'PRODUCT_RESERVED', `No se puede archivar ${p.sku}: tiene reservas activas.`)
  p.status = 'archivado'
  p.updatedAt = nowIso()
  return touch(d)
}

export function restoreProduct(state: WarehouseState, id: string): WarehouseState {
  const d = clone(state)
  const p = getProduct(d, id)
  p.status = 'activo'
  p.updatedAt = nowIso()
  return touch(d)
}

// ---------- ubicaciones ----------

export interface LocationInput {
  code: string
  zoneId: string
  capacity: number
  maxWeightKg?: number
  kind?: Location['kind']
  sizeClass?: Location['sizeClass']
}

export function createLocation(state: WarehouseState, input: LocationInput): WarehouseState {
  const d = clone(state)
  const code = input.code.trim().toUpperCase()
  assert(/^[A-Z]{1,4}-\d{2}-\d{2}-\d{2}$/.test(code), 'LOC_CODE_INVALID', 'El código debe seguir el formato ZONA-PASILLO-MODULO-NIVEL (p. ej. B-03-04-02).')
  assert(!values(d.locations).some((l) => l.code === code), 'LOC_DUPLICATE', `La ubicación ${code} ya existe.`)
  const zone = d.zones[input.zoneId]
  assert(zone, 'ZONE_NOT_FOUND', 'La zona indicada no existe.')
  assert(Number.isInteger(input.capacity) && input.capacity > 0, 'CAPACITY_INVALID', 'La capacidad debe ser un entero positivo.')
  const [, aisle, module, level] = code.split('-')
  const existing = values(d.locations).filter((l) => l.zoneId === zone.id).length
  const cols = Math.max(1, Math.floor((zone.w - 20) / 50))
  const x = zone.x + 10 + (existing % cols) * 50
  const y = zone.y + zone.h - 50 - Math.floor(existing / cols) * 44
  d.locations[`L-${code}`] = {
    id: `L-${code}`, code, zoneId: zone.id, aisle: Number(aisle), module: Number(module), level: Number(level),
    kind: input.kind ?? 'suelo', capacity: input.capacity, maxWeightKg: input.maxWeightKg, sizeClass: input.sizeClass ?? 'L', blocked: false,
    x, y, w: 40, h: 36, accessX: x + 20, accessY: y - 8,
  }
  return touch(d)
}

export function updateLocation(state: WarehouseState, id: string, patch: { capacity?: number; maxWeightKg?: number; sizeClass?: Location['sizeClass'] }): WarehouseState {
  const d = clone(state)
  const loc = getLocation(d, id)
  if (patch.capacity !== undefined) {
    assert(Number.isInteger(patch.capacity) && patch.capacity > 0, 'CAPACITY_INVALID', 'La capacidad debe ser un entero positivo.')
    const occ = occupiedAt(d, id)
    assert(patch.capacity >= occ, 'CAPACITY_BELOW_OCCUPIED', `La ubicación ${loc.code} tiene ${occ} unidades; la capacidad no puede ser inferior.`)
    loc.capacity = patch.capacity
  }
  if (patch.maxWeightKg !== undefined) loc.maxWeightKg = patch.maxWeightKg || undefined
  if (patch.sizeClass !== undefined) loc.sizeClass = patch.sizeClass
  return touch(d)
}

export function blockLocation(state: WarehouseState, id: string, reason: string, u?: string): WarehouseState {
  const d = clone(state)
  const loc = getLocation(d, id)
  assert(!loc.blocked, 'ALREADY_BLOCKED', `La ubicación ${loc.code} ya está bloqueada.`)
  loc.blocked = true
  loc.blockReason = reason.trim() || 'Bloqueo operativo'
  log(d, { type: 'bloqueo', quantity: 0, toLocationId: id, reference: loc.code, user: user(d, u), result: 'ok', notes: `Bloqueo: ${loc.blockReason}` })
  return touch(d)
}

export function unblockLocation(state: WarehouseState, id: string, u?: string): WarehouseState {
  const d = clone(state)
  const loc = getLocation(d, id)
  assert(loc.blocked, 'NOT_BLOCKED', `La ubicación ${loc.code} no está bloqueada.`)
  loc.blocked = false
  loc.blockReason = undefined
  log(d, { type: 'bloqueo', quantity: 0, toLocationId: id, reference: loc.code, user: user(d, u), result: 'ok', notes: 'Desbloqueo de ubicación' })
  return touch(d)
}

export function deleteLocation(state: WarehouseState, id: string): WarehouseState {
  const d = clone(state)
  const loc = getLocation(d, id)
  assert(occupiedAt(d, id) === 0, 'LOCATION_NOT_EMPTY', `La ubicación ${loc.code} contiene mercancía.`)
  delete d.locations[id]
  return touch(d)
}

// ---------- ajustes y transferencias ----------

export function adjustStock(state: WarehouseState, locationId: string, productId: string, delta: number, reason: string, u?: string): WarehouseState {
  const d = clone(state)
  assert(Number.isInteger(delta) && delta !== 0, 'DELTA_INVALID', 'El ajuste debe ser un entero distinto de cero.')
  assert(reason.trim().length >= 3, 'REASON_REQUIRED', 'Indica el motivo del ajuste (mínimo 3 caracteres).')
  getProduct(d, productId)
  if (delta > 0) addStock(d, locationId, productId, delta)
  else removeStock(d, locationId, productId, -delta)
  log(d, { type: 'ajuste', productId, quantity: Math.abs(delta), fromLocationId: delta < 0 ? locationId : undefined, toLocationId: delta > 0 ? locationId : undefined, reference: 'AJUSTE', user: user(d, u), result: 'ok', notes: reason.trim() })
  return touch(d)
}

export interface TransferInput {
  productId: string
  fromLocationId: string
  toLocationId: string
  quantity: number
  reason?: string
  user?: string
  /** Estado de la mercancía a mover (por defecto disponible) */
  state?: StockState
}

export function transferStock(state: WarehouseState, input: TransferInput): WarehouseState {
  const d = clone(state)
  const p = getProduct(d, input.productId)
  const from = getLocation(d, input.fromLocationId)
  const to = getLocation(d, input.toLocationId)
  assertQty(input.quantity)
  const st = input.state ?? 'disponible'
  moveStock(d, p.id, from.id, to.id, input.quantity, st, st)
  const [number, d2] = nextNumber(d, 'transfer', 'TRF')
  const id = newId('trf')
  const ts = nowIso()
  d2.transfers[id] = { id, number, productId: p.id, fromLocationId: from.id, toLocationId: to.id, quantity: input.quantity, reason: input.reason?.trim() || 'Reubicación', user: user(d2, input.user), status: 'completada', createdAt: ts }
  log(d2, { type: 'transferencia', productId: p.id, quantity: input.quantity, fromLocationId: from.id, toLocationId: to.id, reference: number, user: user(d2, input.user), result: 'ok', notes: d2.transfers[id].reason })
  return touch(d2)
}

/** Registra un intento fallido en el historial sin modificar stock (trazabilidad de errores). */
export function logFailedAttempt(state: WarehouseState, type: MovementType, input: { productId?: string; quantity: number; fromLocationId?: string; toLocationId?: string; reference: string; error: string; user?: string }): WarehouseState {
  const d = clone(state)
  log(d, { type, productId: input.productId, quantity: input.quantity, fromLocationId: input.fromLocationId, toLocationId: input.toLocationId, reference: input.reference, user: user(d, input.user), result: 'error', notes: input.error })
  return touch(d)
}

// ---------- recepciones ----------

export interface ReceiptInput {
  supplier: string
  documentRef: string
  date: string
  requiresQc: boolean
  notes?: string
  lines: { productId: string; quantityExpected: number }[]
}

export function createReceipt(state: WarehouseState, input: ReceiptInput): WarehouseState {
  const d = clone(state)
  assert(input.supplier.trim(), 'SUPPLIER_REQUIRED', 'El proveedor es obligatorio.')
  assert(input.lines.length > 0, 'LINES_REQUIRED', 'Añade al menos una línea de producto.')
  const seen = new Set<string>()
  for (const l of input.lines) {
    getProduct(d, l.productId)
    assert(!seen.has(l.productId), 'LINE_DUPLICATE', 'Hay productos repetidos en las líneas.')
    seen.add(l.productId)
    assertQty(l.quantityExpected, 'La cantidad esperada')
  }
  const [number, d2] = nextNumber(d, 'receipt', 'REC')
  const id = newId('rcp')
  const ts = nowIso()
  d2.receipts[id] = {
    id, number, supplier: input.supplier.trim(), documentRef: input.documentRef.trim(), date: input.date || ts.slice(0, 10), status: 'pendiente',
    requiresQc: input.requiresQc, notes: input.notes ?? '', createdAt: ts, updatedAt: ts,
    lines: input.lines.map((l) => ({ id: newId('rln'), productId: l.productId, quantityExpected: l.quantityExpected, quantityReceived: 0, quantityDamaged: 0, qcResult: 'pendiente', notes: '', putAway: false })),
  }
  return touch(d2)
}

function getReceipt(d: Draft, id: string): Receipt {
  const r = d.receipts[id]
  assert(r, 'RECEIPT_NOT_FOUND', 'La recepción no existe.')
  return r
}

export function startReceiving(state: WarehouseState, id: string): WarehouseState {
  const d = clone(state)
  const r = getReceipt(d, id)
  assert(['pendiente', 'borrador'].includes(r.status), 'RECEIPT_STATE', `La recepción ${r.number} ya está en estado ${r.status}.`)
  r.status = 'en_recepcion'
  r.updatedAt = nowIso()
  return touch(d)
}

export function recordReceiptLine(state: WarehouseState, receiptId: string, lineId: string, patch: { quantityReceived?: number; quantityDamaged?: number; destinationLocationId?: string; notes?: string }): WarehouseState {
  const d = clone(state)
  const r = getReceipt(d, receiptId)
  assert(['en_recepcion', 'control_calidad'].includes(r.status), 'RECEIPT_STATE', 'Solo se pueden registrar cantidades en recepciones en curso.')
  const line = r.lines.find((l) => l.id === lineId)
  assert(line, 'LINE_NOT_FOUND', 'Línea no encontrada.')
  assert(!line.putAway, 'LINE_PUT_AWAY', 'La línea ya se ha ubicado y no se puede modificar.')
  if (patch.quantityReceived !== undefined) {
    assert(Number.isInteger(patch.quantityReceived) && patch.quantityReceived >= 0, 'QTY_INVALID', 'La cantidad recibida debe ser un entero mayor o igual que cero.')
    line.quantityReceived = patch.quantityReceived
  }
  if (patch.quantityDamaged !== undefined) {
    assert(Number.isInteger(patch.quantityDamaged) && patch.quantityDamaged >= 0, 'QTY_INVALID', 'Las unidades dañadas deben ser un entero mayor o igual que cero.')
    line.quantityDamaged = patch.quantityDamaged
  }
  assert(line.quantityDamaged <= line.quantityReceived, 'DAMAGED_GT_RECEIVED', 'Las unidades dañadas no pueden superar las recibidas.')
  if (patch.destinationLocationId !== undefined) {
    if (patch.destinationLocationId) getLocation(d, patch.destinationLocationId)
    line.destinationLocationId = patch.destinationLocationId || undefined
  }
  if (patch.notes !== undefined) line.notes = patch.notes
  r.updatedAt = nowIso()
  return touch(d)
}

/** Envía la mercancía recibida a control de calidad: entra físicamente en cuarentena. */
export function sendReceiptToQc(state: WarehouseState, id: string, u?: string): WarehouseState {
  const d = clone(state)
  const r = getReceipt(d, id)
  assert(r.status === 'en_recepcion', 'RECEIPT_STATE', 'Solo se puede enviar a calidad una recepción en curso.')
  const withQty = r.lines.filter((l) => l.quantityReceived > 0)
  assert(withQty.length > 0, 'NOTHING_RECEIVED', 'Registra primero las cantidades recibidas.')
  for (const l of withQty) {
    const good = l.quantityReceived - l.quantityDamaged
    if (good > 0) {
      addStock(d, QC_LOCATION_ID, l.productId, good, 'cuarentena')
      log(d, { type: 'cuarentena', productId: l.productId, quantity: good, toLocationId: QC_LOCATION_ID, reference: r.number, user: user(d, u), result: 'ok', notes: 'Entrada en control de calidad' })
    }
  }
  r.status = 'control_calidad'
  r.updatedAt = nowIso()
  return touch(d)
}

export function resolveQc(state: WarehouseState, receiptId: string, lineId: string, result: 'aprobado' | 'rechazado', notes?: string): WarehouseState {
  const d = clone(state)
  const r = getReceipt(d, receiptId)
  assert(r.status === 'control_calidad', 'RECEIPT_STATE', 'La recepción no está en control de calidad.')
  const line = r.lines.find((l) => l.id === lineId)
  assert(line, 'LINE_NOT_FOUND', 'Línea no encontrada.')
  line.qcResult = result
  if (notes !== undefined) line.notes = notes
  r.updatedAt = nowIso()
  return touch(d)
}

/**
 * Confirma la recepción: ubica la mercancía aprobada en su destino y la dañada/rechazada en la zona auxiliar.
 * Es idempotente por línea (putAway) y solo aumenta el stock disponible en este paso.
 */
export function confirmReceipt(state: WarehouseState, id: string, u?: string): WarehouseState {
  const d = clone(state)
  const r = getReceipt(d, id)
  assert(['en_recepcion', 'control_calidad'].includes(r.status), 'RECEIPT_STATE', `La recepción ${r.number} no se puede confirmar en estado ${r.status}.`)
  if (r.requiresQc) assert(r.status === 'control_calidad', 'QC_REQUIRED', 'Esta recepción requiere control de calidad antes de confirmarse.')
  const pending = r.lines.filter((l) => !l.putAway && l.quantityReceived > 0)
  assert(r.lines.some((l) => l.quantityReceived > 0), 'NOTHING_RECEIVED', 'No hay cantidades recibidas que ubicar.')
  for (const l of pending) {
    if (r.status === 'control_calidad') assert(l.qcResult !== 'pendiente', 'QC_PENDING', `Falta el resultado de calidad de ${d.products[l.productId]?.sku}.`)
    const good = l.quantityReceived - l.quantityDamaged
    const approved = r.status !== 'control_calidad' || l.qcResult === 'aprobado'
    if (good > 0 && approved) assert(l.destinationLocationId, 'DESTINATION_REQUIRED', `Asigna ubicación de destino a ${d.products[l.productId]?.sku}.`)
  }
  for (const l of pending) {
    const good = l.quantityReceived - l.quantityDamaged
    const inQc = r.status === 'control_calidad'
    if (good > 0) {
      if (inQc && l.qcResult === 'rechazado') {
        moveStock(d, l.productId, QC_LOCATION_ID, AUX_LOCATION_ID, good, 'cuarentena', 'devolucion_proveedor', false)
        log(d, { type: 'cuarentena', productId: l.productId, quantity: good, fromLocationId: QC_LOCATION_ID, toLocationId: AUX_LOCATION_ID, reference: r.number, user: user(d, u), result: 'ok', notes: 'Rechazado en calidad: pendiente de devolución al proveedor' })
      } else if (inQc) {
        moveStock(d, l.productId, QC_LOCATION_ID, l.destinationLocationId!, good, 'cuarentena', 'disponible', false)
        log(d, { type: 'entrada', productId: l.productId, quantity: good, fromLocationId: QC_LOCATION_ID, toLocationId: l.destinationLocationId, reference: r.number, user: user(d, u), result: 'ok', notes: 'Aprobado en calidad y ubicado' })
      } else {
        addStock(d, l.destinationLocationId!, l.productId, good, 'disponible')
        log(d, { type: 'entrada', productId: l.productId, quantity: good, toLocationId: l.destinationLocationId, reference: r.number, user: user(d, u), result: 'ok', notes: `Recepción de ${r.supplier}` })
      }
    }
    if (l.quantityDamaged > 0) {
      addStock(d, AUX_LOCATION_ID, l.productId, l.quantityDamaged, 'danado')
      log(d, { type: 'entrada', productId: l.productId, quantity: l.quantityDamaged, toLocationId: AUX_LOCATION_ID, reference: r.number, user: user(d, u), result: 'ok', notes: 'Mercancía dañada en recepción (no disponible)' })
    }
    l.putAway = true
  }
  const anyShort = r.lines.some((l) => l.quantityReceived < l.quantityExpected)
  const anyIssue = r.lines.some((l) => l.quantityDamaged > 0 || l.qcResult === 'rechazado' || l.quantityReceived > l.quantityExpected)
  r.status = anyIssue ? 'incidencia' : anyShort ? 'parcial' : 'completada'
  r.confirmedAt = nowIso()
  r.updatedAt = r.confirmedAt
  return touch(d)
}

export function deleteReceipt(state: WarehouseState, id: string): WarehouseState {
  const d = clone(state)
  const r = getReceipt(d, id)
  assert(['pendiente', 'borrador'].includes(r.status), 'RECEIPT_STATE', 'Solo se pueden eliminar recepciones pendientes.')
  delete d.receipts[id]
  return touch(d)
}

// ---------- pedidos / picking ----------

export interface OrderInput {
  customer: string
  date?: string
  priority: OrderPriority
  notes?: string
  lines: { productId: string; quantity: number }[]
}

/** Reserva unidades de una línea en ubicaciones siguiendo el orden de recorrido de picking. */
function allocateLine(d: Draft, line: OrderLine) {
  let needed = line.quantityRequested - line.quantityReserved
  if (needed <= 0) return
  const candidates = values(d.locations)
    .filter((l) => !l.blocked && !['Z-CON', 'Z-EXP', 'Z-QC', 'Z-DEV', 'Z-AUX', 'Z-MDE', 'Z-MCA'].includes(l.zoneId))
    .map((l) => ({ loc: l, avail: availableAt(d, l.id, line.productId) }))
    .filter((c) => c.avail > 0)
    .sort((a, b) => {
      // Primero zona de picking, luego orden serpenteante de pasillos
      const pa = a.loc.zoneId === 'Z-PCK' ? 0 : 1
      const pb = b.loc.zoneId === 'Z-PCK' ? 0 : 1
      if (pa !== pb) return pa - pb
      return pickingSortKey(a.loc) - pickingSortKey(b.loc)
    })
  for (const c of candidates) {
    if (needed <= 0) break
    const take = Math.min(c.avail, needed)
    const existing = line.reservations.find((r) => r.locationId === c.loc.id)
    if (existing) existing.quantity += take
    else line.reservations.push({ locationId: c.loc.id, quantity: take, picked: 0 })
    line.quantityReserved += take
    needed -= take
  }
}

function refreshOrderStatus(o: Order) {
  if (['cancelado', 'enviado', 'en_expedicion'].includes(o.status)) return
  const allPicked = o.lines.every((l) => l.quantityPicked >= l.quantityRequested)
  const anyPicked = o.lines.some((l) => l.quantityPicked > 0)
  if (allPicked) o.status = 'preparado'
  else if (anyPicked) o.status = 'parcialmente_preparado'
  else if (o.status !== 'en_preparacion') o.status = 'pendiente'
}

export function createOrder(state: WarehouseState, input: OrderInput): WarehouseState {
  const d = clone(state)
  assert(input.customer.trim(), 'CUSTOMER_REQUIRED', 'El cliente o destinatario es obligatorio.')
  assert(input.lines.length > 0, 'LINES_REQUIRED', 'Añade al menos una línea al pedido.')
  const seen = new Set<string>()
  for (const l of input.lines) {
    const p = getProduct(d, l.productId)
    assert(p.status === 'activo', 'PRODUCT_ARCHIVED', `El producto ${p.sku} está archivado.`)
    assert(!seen.has(l.productId), 'LINE_DUPLICATE', 'Hay productos repetidos en el pedido.')
    seen.add(l.productId)
    assertQty(l.quantity)
  }
  const [number, d2] = nextNumber(d, 'order', 'PED')
  const id = newId('ord')
  const ts = nowIso()
  const order: Order = {
    id, number, customer: input.customer.trim(), date: input.date || ts.slice(0, 10), priority: input.priority, status: 'pendiente', notes: input.notes ?? '',
    lines: input.lines.map((l) => ({ id: newId('oln'), productId: l.productId, quantityRequested: l.quantity, quantityReserved: 0, quantityPicked: 0, reservations: [] })),
    createdAt: ts, updatedAt: ts,
  }
  d2.orders[id] = order
  for (const line of order.lines) {
    allocateLine(d2, line)
    if (line.quantityReserved > 0) log(d2, { type: 'reserva', productId: line.productId, quantity: line.quantityReserved, reference: number, user: user(d2), result: 'ok', notes: `Reserva para ${order.customer}` })
  }
  return touch(d2)
}

function getOrder(d: Draft, id: string): Order {
  const o = d.orders[id]
  assert(o, 'ORDER_NOT_FOUND', 'El pedido no existe.')
  return o
}

/** Intenta completar las reservas pendientes de un pedido (p. ej. tras una recepción). */
export function reallocateOrder(state: WarehouseState, id: string): WarehouseState {
  const d = clone(state)
  const o = getOrder(d, id)
  assert(['pendiente', 'en_preparacion', 'parcialmente_preparado'].includes(o.status), 'ORDER_STATE', 'El pedido no admite nuevas reservas.')
  let added = 0
  for (const line of o.lines) {
    const before = line.quantityReserved
    allocateLine(d, line)
    const delta = line.quantityReserved - before
    if (delta > 0) {
      added += delta
      log(d, { type: 'reserva', productId: line.productId, quantity: delta, reference: o.number, user: user(d), result: 'ok', notes: 'Reserva completada' })
    }
  }
  assert(added > 0, 'NO_STOCK_TO_RESERVE', 'No hay stock disponible adicional para reservar.')
  o.updatedAt = nowIso()
  return touch(d)
}

export function startPicking(state: WarehouseState, id: string): WarehouseState {
  const d = clone(state)
  const o = getOrder(d, id)
  assert(o.status === 'pendiente', 'ORDER_STATE', `El pedido ${o.number} no está pendiente.`)
  assert(o.lines.some((l) => l.quantityReserved > 0), 'NOTHING_RESERVED', 'El pedido no tiene stock reservado para preparar.')
  o.status = 'en_preparacion'
  o.updatedAt = nowIso()
  return touch(d)
}

/** Confirma la recogida de unidades de una línea en una ubicación; la mercancía pasa a consolidación. */
export function confirmPick(state: WarehouseState, orderId: string, lineId: string, locationId: string, qty: number, u?: string): WarehouseState {
  const d = clone(state)
  const o = getOrder(d, orderId)
  assert(['en_preparacion', 'parcialmente_preparado', 'pendiente'].includes(o.status), 'ORDER_STATE', `El pedido ${o.number} no está en preparación.`)
  const line = o.lines.find((l) => l.id === lineId)
  assert(line, 'LINE_NOT_FOUND', 'Línea no encontrada.')
  const res = line.reservations.find((r) => r.locationId === locationId)
  assert(res, 'NO_RESERVATION', 'No hay reserva en esa ubicación para esta línea.')
  assertQty(qty)
  const pendingHere = res.quantity - res.picked
  assert(qty <= pendingHere, 'PICK_EXCEEDS', `Solo quedan ${pendingHere} unidades por recoger en ${d.locations[locationId]?.code}.`)
  // La mercancía reservada se mueve físicamente (ignorando la propia reserva, que se consume aquí)
  res.picked += qty
  line.quantityPicked += qty
  removeStock(d, locationId, line.productId, qty, 'disponible', false)
  addStock(d, STAGING_LOCATION_ID, line.productId, qty, 'disponible')
  log(d, { type: 'picking', productId: line.productId, quantity: qty, fromLocationId: locationId, toLocationId: STAGING_LOCATION_ID, reference: o.number, user: user(d, u), result: 'ok', notes: `Picking para ${o.customer}` })
  if (o.status === 'pendiente') o.status = 'en_preparacion'
  refreshOrderStatus(o)
  o.updatedAt = nowIso()
  return touch(d)
}

/** Recoge de golpe todas las líneas reservadas pendientes. */
export function pickAll(state: WarehouseState, orderId: string, u?: string): WarehouseState {
  let s = state
  const o = getOrder(clone(state), orderId)
  let any = false
  for (const line of o.lines) for (const r of line.reservations) {
    const pending = r.quantity - r.picked
    if (pending > 0) { s = confirmPick(s, orderId, line.id, r.locationId, pending, u); any = true }
  }
  assert(any, 'NOTHING_TO_PICK', 'No hay unidades reservadas pendientes de recoger.')
  return s
}

export function cancelOrder(state: WarehouseState, id: string, reason: string, u?: string): WarehouseState {
  const d = clone(state)
  const o = getOrder(d, id)
  assert(!['enviado', 'cancelado', 'en_expedicion'].includes(o.status), 'ORDER_STATE', `El pedido ${o.number} no se puede cancelar en estado ${o.status}.`)
  for (const line of o.lines) {
    // Devolver a origen lo ya recogido (está en consolidación)
    for (const r of line.reservations) {
      if (r.picked > 0) {
        moveStock(d, line.productId, STAGING_LOCATION_ID, r.locationId, r.picked, 'disponible', 'disponible', false)
        log(d, { type: 'transferencia', productId: line.productId, quantity: r.picked, fromLocationId: STAGING_LOCATION_ID, toLocationId: r.locationId, reference: o.number, user: user(d, u), result: 'ok', notes: 'Retorno a ubicación por cancelación de pedido' })
      }
    }
    const released = line.quantityReserved - line.quantityPicked
    if (released > 0) log(d, { type: 'liberacion', productId: line.productId, quantity: released, reference: o.number, user: user(d, u), result: 'ok', notes: `Liberación de reserva: ${reason || 'cancelación'}` })
    line.reservations = []
    line.quantityReserved = 0
    line.quantityPicked = 0
  }
  o.status = 'cancelado'
  o.notes = [o.notes, `Cancelado: ${reason}`].filter(Boolean).join(' · ')
  o.updatedAt = nowIso()
  return touch(d)
}

// ---------- expediciones ----------

export interface ShipmentInput {
  orderIds: string[]
  recipient: string
  carrier: string
  trackingRef: string
  date?: string
  notes?: string
}

function pickExpeditionLocation(d: Draft, productId: string, qty: number): string {
  const exp = values(d.locations).filter((l) => l.zoneId === 'Z-EXP' && !l.blocked).sort((a, b) => a.code.localeCompare(b.code))
  for (const l of exp) if (!checkCanReceive(d, l.id, productId, qty)) return l.id
  throw new DomainError('EXPEDITION_FULL', 'No hay espacio libre en la zona de expedición.')
}

export function createShipment(state: WarehouseState, input: ShipmentInput): WarehouseState {
  const d = clone(state)
  assert(input.orderIds.length > 0, 'ORDERS_REQUIRED', 'Selecciona al menos un pedido preparado.')
  assert(input.recipient.trim(), 'RECIPIENT_REQUIRED', 'El destinatario es obligatorio.')
  assert(input.carrier.trim(), 'CARRIER_REQUIRED', 'El transportista es obligatorio.')
  const orders = input.orderIds.map((id) => getOrder(d, id))
  for (const o of orders) assert(o.status === 'preparado', 'ORDER_NOT_READY', `El pedido ${o.number} no está preparado (estado: ${o.status}).`)
  const [number, d2] = nextNumber(d, 'shipment', 'EXP')
  const id = newId('shp')
  const ts = nowIso()
  d2.shipments[id] = { id, number, orderIds: input.orderIds, recipient: input.recipient.trim(), carrier: input.carrier.trim(), trackingRef: input.trackingRef.trim(), date: input.date || ts.slice(0, 10), notes: input.notes ?? '', status: 'pendiente', createdAt: ts }
  for (const o of orders) {
    const ord = getOrder(d2, o.id)
    for (const line of ord.lines) {
      if (line.quantityPicked > 0) {
        const to = pickExpeditionLocation(d2, line.productId, line.quantityPicked)
        moveStock(d2, line.productId, STAGING_LOCATION_ID, to, line.quantityPicked, 'disponible', 'disponible', false)
        log(d2, { type: 'transferencia', productId: line.productId, quantity: line.quantityPicked, fromLocationId: STAGING_LOCATION_ID, toLocationId: to, reference: number, user: user(d2), result: 'ok', notes: `Traslado a expedición (${ord.number})` })
      }
    }
    ord.status = 'en_expedicion'
    ord.shipmentId = id
    ord.updatedAt = ts
  }
  return touch(d2)
}

function getShipment(d: Draft, id: string): Shipment {
  const s = d.shipments[id]
  assert(s, 'SHIPMENT_NOT_FOUND', 'La expedición no existe.')
  return s
}

/** Confirmación final de salida. Idempotente: una expedición confirmada no vuelve a descontar stock. */
export function confirmShipment(state: WarehouseState, id: string, u?: string): WarehouseState {
  const d = clone(state)
  const s = getShipment(d, id)
  assert(s.status !== 'confirmada', 'SHIPMENT_ALREADY_CONFIRMED', `La expedición ${s.number} ya fue confirmada el ${new Date(s.confirmedAt!).toLocaleString('es-ES')}. No se modifica el stock.`)
  assert(s.status === 'pendiente', 'SHIPMENT_STATE', 'La expedición está cancelada.')
  const ts = nowIso()
  for (const oid of s.orderIds) {
    const o = getOrder(d, oid)
    assert(o.status === 'en_expedicion', 'ORDER_STATE', `El pedido ${o.number} no está en expedición.`)
    for (const line of o.lines) {
      let remaining = line.quantityPicked
      const expEntries = values(d.stock).filter((e) => e.productId === line.productId && d.locations[e.locationId]?.zoneId === 'Z-EXP' && e.state === 'disponible')
      for (const e of expEntries) {
        if (remaining <= 0) break
        const take = Math.min(e.quantity, remaining)
        removeStock(d, e.locationId, line.productId, take, 'disponible', false)
        log(d, { type: 'salida', productId: line.productId, quantity: take, fromLocationId: e.locationId, reference: s.number, user: user(d, u), result: 'ok', notes: `Salida pedido ${o.number} · ${s.carrier}` })
        remaining -= take
      }
      assert(remaining === 0, 'EXPEDITION_STOCK_MISMATCH', `No se encuentra en expedición toda la mercancía del pedido ${o.number}.`)
    }
    o.status = 'enviado'
    o.updatedAt = ts
  }
  s.status = 'confirmada'
  s.confirmedAt = ts
  return touch(d)
}

export function cancelShipment(state: WarehouseState, id: string, u?: string): WarehouseState {
  const d = clone(state)
  const s = getShipment(d, id)
  assert(s.status === 'pendiente', 'SHIPMENT_STATE', 'Solo se pueden cancelar expediciones pendientes.')
  for (const oid of s.orderIds) {
    const o = getOrder(d, oid)
    for (const line of o.lines) {
      let remaining = line.quantityPicked
      const expEntries = values(d.stock).filter((e) => e.productId === line.productId && d.locations[e.locationId]?.zoneId === 'Z-EXP' && e.state === 'disponible')
      for (const e of expEntries) {
        if (remaining <= 0) break
        const take = Math.min(e.quantity, remaining)
        moveStock(d, line.productId, e.locationId, STAGING_LOCATION_ID, take, 'disponible', 'disponible', false)
        log(d, { type: 'transferencia', productId: line.productId, quantity: take, fromLocationId: e.locationId, toLocationId: STAGING_LOCATION_ID, reference: s.number, user: user(d, u), result: 'ok', notes: 'Retorno a consolidación por cancelación de expedición' })
        remaining -= take
      }
    }
    o.status = 'preparado'
    o.shipmentId = undefined
    o.updatedAt = nowIso()
  }
  s.status = 'cancelada'
  return touch(d)
}

// ---------- devoluciones ----------

export interface ReturnInput {
  orderId?: string
  productId: string
  quantity: number
  reason: string
  packagingState: Return['packagingState']
  user?: string
}

export function createReturn(state: WarehouseState, input: ReturnInput): WarehouseState {
  const d = clone(state)
  const p = getProduct(d, input.productId)
  assertQty(input.quantity)
  assert(input.reason.trim(), 'REASON_REQUIRED', 'Indica el motivo de la devolución.')
  if (input.orderId) {
    const o = getOrder(d, input.orderId)
    assert(o.status === 'enviado', 'ORDER_NOT_SHIPPED', `El pedido ${o.number} no ha sido enviado; no admite devoluciones.`)
    const line = o.lines.find((l) => l.productId === p.id)
    assert(line, 'PRODUCT_NOT_IN_ORDER', `El pedido ${o.number} no contiene ${p.sku}.`)
    const already = values(d.returns).filter((r) => r.orderId === o.id && r.productId === p.id).reduce((a, r) => a + r.quantity, 0)
    assert(already + input.quantity <= line.quantityPicked, 'RETURN_EXCEEDS', `El pedido solo envió ${line.quantityPicked} uds de ${p.sku} (ya devueltas ${already}).`)
  }
  const [number, d2] = nextNumber(d, 'return', 'DEV')
  const id = newId('ret')
  const ts = nowIso()
  addStock(d2, RETURNS_LOCATION_ID, p.id, input.quantity, 'cuarentena')
  d2.returns[id] = { id, number, orderId: input.orderId, productId: p.id, quantity: input.quantity, reason: input.reason.trim(), packagingState: input.packagingState, inspectionNotes: '', classification: 'pendiente_inspeccion', status: 'registrada', user: user(d2, input.user), createdAt: ts }
  log(d2, { type: 'devolucion', productId: p.id, quantity: input.quantity, toLocationId: RETURNS_LOCATION_ID, reference: number, user: user(d2, input.user), result: 'ok', notes: `Devolución registrada (pendiente de inspección): ${input.reason}` })
  return touch(d2)
}

/** Inspección y clasificación. Solo la mercancía «apta» vuelve al stock disponible. */
export function inspectReturn(state: WarehouseState, id: string, classification: Exclude<ReturnClassification, 'pendiente_inspeccion'>, notes: string, destinationLocationId?: string, u?: string): WarehouseState {
  const d = clone(state)
  const r = d.returns[id]
  assert(r, 'RETURN_NOT_FOUND', 'La devolución no existe.')
  assert(r.status === 'registrada', 'RETURN_STATE', `La devolución ${r.number} ya fue inspeccionada.`)
  const ts = nowIso()
  if (classification === 'apta') {
    assert(destinationLocationId, 'DESTINATION_REQUIRED', 'Indica la ubicación de destino para reincorporar la mercancía.')
    moveStock(d, r.productId, RETURNS_LOCATION_ID, destinationLocationId, r.quantity, 'cuarentena', 'disponible', false)
    log(d, { type: 'devolucion', productId: r.productId, quantity: r.quantity, fromLocationId: RETURNS_LOCATION_ID, toLocationId: destinationLocationId, reference: r.number, user: user(d, u), result: 'ok', notes: 'Inspección aprobada: reincorporada al stock disponible' })
    r.destinationLocationId = destinationLocationId
    r.status = 'cerrada'
    r.closedAt = ts
  } else if (classification === 'danada' || classification === 'obsoleta') {
    const st: StockState = classification === 'danada' ? 'danado' : 'obsoleto'
    moveStock(d, r.productId, RETURNS_LOCATION_ID, AUX_LOCATION_ID, r.quantity, 'cuarentena', st, false)
    log(d, { type: 'devolucion', productId: r.productId, quantity: r.quantity, fromLocationId: RETURNS_LOCATION_ID, toLocationId: AUX_LOCATION_ID, reference: r.number, user: user(d, u), result: 'ok', notes: `Clasificada como ${classification}: a zona auxiliar (no disponible)` })
    r.destinationLocationId = AUX_LOCATION_ID
    r.status = 'cerrada'
    r.closedAt = ts
  } else {
    // pendiente de devolución al proveedor: permanece en zona de devoluciones con estado específico
    removeStock(d, RETURNS_LOCATION_ID, r.productId, r.quantity, 'cuarentena', false)
    addStock(d, RETURNS_LOCATION_ID, r.productId, r.quantity, 'devolucion_proveedor')
    log(d, { type: 'devolucion', productId: r.productId, quantity: r.quantity, toLocationId: RETURNS_LOCATION_ID, reference: r.number, user: user(d, u), result: 'ok', notes: 'Clasificada: pendiente de devolución al proveedor' })
    r.destinationLocationId = RETURNS_LOCATION_ID
    r.status = 'inspeccionada'
  }
  r.classification = classification
  r.inspectionNotes = notes
  return touch(d)
}

/** Salida definitiva de la mercancía devuelta al proveedor. */
export function closeReturnToSupplier(state: WarehouseState, id: string, u?: string): WarehouseState {
  const d = clone(state)
  const r = d.returns[id]
  assert(r, 'RETURN_NOT_FOUND', 'La devolución no existe.')
  assert(r.status === 'inspeccionada' && r.classification === 'devolucion_proveedor', 'RETURN_STATE', 'Solo se cierran devoluciones pendientes de envío al proveedor.')
  removeStock(d, RETURNS_LOCATION_ID, r.productId, r.quantity, 'devolucion_proveedor', false)
  log(d, { type: 'salida', productId: r.productId, quantity: r.quantity, fromLocationId: RETURNS_LOCATION_ID, reference: r.number, user: user(d, u), result: 'ok', notes: 'Enviada al proveedor' })
  r.status = 'cerrada'
  r.closedAt = nowIso()
  return touch(d)
}

/** Retira mercancía dañada u obsoleta de la zona auxiliar (destrucción / reciclaje documentado). */
export function disposeStock(state: WarehouseState, locationId: string, productId: string, qty: number, stockState: StockState, reason: string, u?: string): WarehouseState {
  const d = clone(state)
  assert(stockState !== 'disponible', 'DISPOSE_AVAILABLE', 'La mercancía disponible se retira mediante ajuste documentado.')
  assert(reason.trim().length >= 3, 'REASON_REQUIRED', 'Indica el motivo de la retirada.')
  removeStock(d, locationId, productId, qty, stockState, false)
  log(d, { type: 'salida', productId, quantity: qty, fromLocationId: locationId, reference: 'RETIRADA', user: user(d, u), result: 'ok', notes: `Retirada de mercancía (${stockState}): ${reason}` })
  return touch(d)
}

export function updateSettings(state: WarehouseState, patch: Partial<WarehouseState['settings']>): WarehouseState {
  const d = clone(state)
  Object.assign(d.settings, patch)
  return touch(d)
}

export type { ReceiptLine }
