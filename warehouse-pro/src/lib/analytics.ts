import { values, type WarehouseState, type Movement } from '@/domain'

export function dayKey(iso: string) { return iso.slice(0, 10) }

export function dailySeries(state: WarehouseState, days: number, from?: string, to?: string) {
  const end = to ? new Date(to + 'T23:59:59') : new Date()
  const start = from ? new Date(from + 'T00:00:00') : new Date(end.getTime() - (days - 1) * 86400000)
  const map = new Map<string, { day: string; entradas: number; salidas: number; transferencias: number; picking: number; devoluciones: number; ajustes: number; movimientos: number }>()
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
    const k = d.toISOString().slice(0, 10)
    map.set(k, { day: k, entradas: 0, salidas: 0, transferencias: 0, picking: 0, devoluciones: 0, ajustes: 0, movimientos: 0 })
  }
  for (const m of values(state.movements)) {
    if (m.result !== 'ok') continue
    const row = map.get(dayKey(m.timestamp))
    if (!row) continue
    row.movimientos++
    if (m.type === 'entrada') row.entradas += m.quantity
    else if (m.type === 'salida') row.salidas += m.quantity
    else if (m.type === 'transferencia') row.transferencias += m.quantity
    else if (m.type === 'picking') row.picking += m.quantity
    else if (m.type === 'devolucion') row.devoluciones += m.quantity
    else if (m.type === 'ajuste') row.ajustes += m.quantity
  }
  return [...map.values()]
}

/** Evolución del stock total reconstruida hacia atrás a partir de los movimientos. */
export function stockEvolution(state: WarehouseState, days: number) {
  const total = values(state.stock).reduce((a, s) => a + s.quantity, 0)
  const series = dailySeries(state, days)
  const out: { day: string; stock: number }[] = []
  let running = total
  for (let i = series.length - 1; i >= 0; i--) {
    out.unshift({ day: series[i].day, stock: running })
    // Deshacer el día: restar entradas/devoluciones, sumar salidas
    running = running - series[i].entradas - series[i].devoluciones + series[i].salidas
  }
  return out
}

export function filterMovements(movs: Movement[], f: { from?: string; to?: string }) {
  return movs.filter((m) => (!f.from || dayKey(m.timestamp) >= f.from) && (!f.to || dayKey(m.timestamp) <= f.to))
}

export function productRotation(state: WarehouseState, from?: string, to?: string) {
  const counts = new Map<string, { out: number; moves: number; last?: string }>()
  for (const m of filterMovements(values(state.movements), { from, to })) {
    if (!m.productId || m.result !== 'ok') continue
    const c = counts.get(m.productId) ?? { out: 0, moves: 0 }
    c.moves++
    if (m.type === 'salida' || m.type === 'picking') c.out += m.quantity
    if (!c.last || m.timestamp > c.last) c.last = m.timestamp
    counts.set(m.productId, c)
  }
  return values(state.products)
    .filter((p) => p.status === 'activo')
    .map((p) => ({ product: p, ...(counts.get(p.id) ?? { out: 0, moves: 0, last: undefined }) }))
}

export function pickingProductivity(state: WarehouseState, from?: string, to?: string) {
  const picks = filterMovements(values(state.movements), { from, to }).filter((m) => m.type === 'picking' && m.result === 'ok')
  const byUser = new Map<string, { lines: number; units: number }>()
  for (const p of picks) {
    const u = byUser.get(p.user) ?? { lines: 0, units: 0 }
    u.lines++
    u.units += p.quantity
    byUser.set(p.user, u)
  }
  return { total: picks.length, units: picks.reduce((a, p) => a + p.quantity, 0), byUser: [...byUser.entries()].map(([user, v]) => ({ user, ...v })).sort((a, b) => b.units - a.units) }
}
