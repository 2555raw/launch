import type { Location, Order, Product, StockEntry, WarehouseState, Movement } from './types'

export const values = <T,>(rec: Record<string, T>): T[] => Object.values(rec)

export function stockEntriesAt(state: WarehouseState, locationId: string): StockEntry[] {
  return values(state.stock).filter((s) => s.locationId === locationId && s.quantity > 0)
}

export function stockEntriesOf(state: WarehouseState, productId: string): StockEntry[] {
  return values(state.stock).filter((s) => s.productId === productId && s.quantity > 0)
}

/** Unidades físicas ocupadas en una ubicación (todos los estados). */
export function occupiedAt(state: WarehouseState, locationId: string): number {
  return stockEntriesAt(state, locationId).reduce((a, s) => a + s.quantity, 0)
}

export function weightAt(state: WarehouseState, locationId: string): number {
  return stockEntriesAt(state, locationId).reduce((a, s) => a + s.quantity * (state.products[s.productId]?.weightKg ?? 0), 0)
}

export type LocationStatus = 'libre' | 'parcial' | 'completa' | 'bloqueada'

export function locationStatus(state: WarehouseState, loc: Location): LocationStatus {
  if (loc.blocked) return 'bloqueada'
  const occ = occupiedAt(state, loc.id)
  if (occ === 0) return 'libre'
  if (occ >= loc.capacity) return 'completa'
  return 'parcial'
}

/** Cantidad reservada de un producto en una ubicación por pedidos activos (sin recoger). */
export function reservedAt(state: WarehouseState, locationId: string, productId: string): number {
  let total = 0
  for (const o of values(state.orders)) {
    if (!['pendiente', 'en_preparacion', 'parcialmente_preparado'].includes(o.status)) continue
    for (const l of o.lines) {
      if (l.productId !== productId) continue
      for (const r of l.reservations) if (r.locationId === locationId) total += r.quantity - r.picked
    }
  }
  return total
}

export function reservedOf(state: WarehouseState, productId: string): number {
  let total = 0
  for (const o of values(state.orders)) {
    if (!['pendiente', 'en_preparacion', 'parcialmente_preparado'].includes(o.status)) continue
    for (const l of o.lines) if (l.productId === productId) total += l.quantityReserved - l.quantityPicked
  }
  return total
}

/** Stock disponible físico en una ubicación (estado disponible menos reservas). */
export function availableAt(state: WarehouseState, locationId: string, productId: string): number {
  const phys = stockEntriesAt(state, locationId)
    .filter((s) => s.productId === productId && s.state === 'disponible')
    .reduce((a, s) => a + s.quantity, 0)
  return phys - reservedAt(state, locationId, productId)
}

export interface ProductStockSummary {
  productId: string
  total: number
  available: number
  reserved: number
  quarantine: number
  damaged: number
  locations: { locationId: string; code: string; quantity: number; state: StockEntry['state'] }[]
}

export function productStock(state: WarehouseState, productId: string): ProductStockSummary {
  const entries = stockEntriesOf(state, productId)
  const stagingZones = new Set(['Z-CON', 'Z-EXP'])
  let total = 0
  let disponible = 0
  let quarantine = 0
  let damaged = 0
  for (const e of entries) {
    const loc = state.locations[e.locationId]
    total += e.quantity
    if (e.state === 'disponible' && loc && !stagingZones.has(loc.zoneId)) disponible += e.quantity
    else if (e.state === 'cuarentena') quarantine += e.quantity
    else if (e.state === 'danado' || e.state === 'obsoleto' || e.state === 'devolucion_proveedor') damaged += e.quantity
  }
  const reserved = reservedOf(state, productId)
  return {
    productId,
    total,
    available: Math.max(0, disponible - reserved),
    reserved,
    quarantine,
    damaged,
    locations: entries
      .map((e) => ({ locationId: e.locationId, code: state.locations[e.locationId]?.code ?? e.locationId, quantity: e.quantity, state: e.state }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  }
}

export function activeProducts(state: WarehouseState): Product[] {
  return values(state.products).filter((p) => p.status === 'activo').sort((a, b) => a.sku.localeCompare(b.sku))
}

export function lowStockProducts(state: WarehouseState) {
  return activeProducts(state)
    .map((p) => ({ product: p, stock: productStock(state, p.id) }))
    .filter(({ product, stock }) => stock.available < product.minStock)
}

export function warehouseOccupancy(state: WarehouseState) {
  const locs = values(state.locations).filter((l) => l.kind === 'estanteria')
  let capacity = 0
  let occupied = 0
  let free = 0
  let partial = 0
  let full = 0
  let blocked = 0
  for (const l of locs) {
    capacity += l.capacity
    const occ = occupiedAt(state, l.id)
    occupied += Math.min(occ, l.capacity)
    const st = locationStatus(state, l)
    if (st === 'libre') free++
    else if (st === 'parcial') partial++
    else if (st === 'completa') full++
    else blocked++
  }
  return { capacity, occupied, pct: capacity ? Math.round((occupied / capacity) * 100) : 0, free, partial, full, blocked, total: locs.length }
}

export function occupancyByZone(state: WarehouseState) {
  return values(state.zones)
    .filter((z) => values(state.locations).some((l) => l.zoneId === z.id))
    .map((z) => {
      const locs = values(state.locations).filter((l) => l.zoneId === z.id)
      const capacity = locs.reduce((a, l) => a + l.capacity, 0)
      const occupied = locs.reduce((a, l) => a + occupiedAt(state, l.id), 0)
      return { zone: z, capacity, occupied, pct: capacity ? Math.round((occupied / capacity) * 100) : 0, locations: locs.length }
    })
}

export function movementsSorted(state: WarehouseState): Movement[] {
  return values(state.movements).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

export function orderProgress(order: Order): number {
  const req = order.lines.reduce((a, l) => a + l.quantityRequested, 0)
  const picked = order.lines.reduce((a, l) => a + l.quantityPicked, 0)
  return req ? Math.round((picked / req) * 100) : 0
}

export function orderShortages(state: WarehouseState, order: Order) {
  return order.lines
    .filter((l) => l.quantityReserved < l.quantityRequested)
    .map((l) => ({ line: l, product: state.products[l.productId], missing: l.quantityRequested - l.quantityReserved }))
}

/** Comprobación de coherencia global (regla: ninguna cantidad negativa, reservas ≤ stock, capacidad). */
export function integrityIssues(state: WarehouseState): string[] {
  const issues: string[] = []
  for (const s of values(state.stock)) {
    if (s.quantity < 0) issues.push(`Stock negativo en ${state.locations[s.locationId]?.code}: ${s.quantity}`)
  }
  for (const l of values(state.locations)) {
    const occ = occupiedAt(state, l.id)
    if (occ > l.capacity) issues.push(`Ubicación ${l.code} supera su capacidad (${occ}/${l.capacity})`)
  }
  for (const p of values(state.products)) {
    const summary = productStock(state, p.id)
    const phys = stockEntriesOf(state, p.id).filter((e) => e.state === 'disponible').reduce((a, e) => a + e.quantity, 0)
    if (summary.reserved > phys) issues.push(`Reservas de ${p.sku} (${summary.reserved}) superan el stock disponible (${phys})`)
  }
  return issues
}

export function isLocationStorable(loc: Location): boolean {
  return loc.kind !== 'muelle'
}
