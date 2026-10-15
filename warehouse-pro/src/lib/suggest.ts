import { checkCanReceive, occupiedAt, pickingSortKey, stockEntriesAt, values, type Location, type WarehouseState } from '@/domain'

/** Ubicaciones de almacenamiento compatibles con un producto y cantidad, ordenadas por idoneidad. */
export function compatibleLocations(state: WarehouseState, productId: string, qty: number, opts: { includeOperational?: boolean } = {}): { loc: Location; free: number; reason: string | null; sameProduct: boolean }[] {
  const p = state.products[productId]
  const storageZones = ['Z-A', 'Z-B', 'Z-C', 'Z-D', 'Z-CNG', 'Z-PCK']
  return values(state.locations)
    .filter((l) => l.kind !== 'muelle' && (opts.includeOperational || storageZones.includes(l.zoneId)))
    .map((l) => ({ loc: l, free: l.capacity - occupiedAt(state, l.id), reason: checkCanReceive(state, l.id, productId, qty), sameProduct: stockEntriesAt(state, l.id).some((e) => e.productId === productId) }))
    .sort((a, b) => {
      if (!!a.reason !== !!b.reason) return a.reason ? 1 : -1
      if (a.sameProduct !== b.sameProduct) return a.sameProduct ? -1 : 1
      // Alta rotación: cerca del picking (clave de recorrido baja); baja rotación: al fondo
      const ka = pickingSortKey(a.loc), kb = pickingSortKey(b.loc)
      if (p?.rotation === 'baja') return kb - ka
      return ka - kb
    })
}

export function suggestLocation(state: WarehouseState, productId: string, qty: number): Location | null {
  const c = compatibleLocations(state, productId, qty).find((x) => !x.reason)
  return c?.loc ?? null
}
