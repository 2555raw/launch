import { locationStatus, occupiedAt, stockEntriesAt, type Location, type WarehouseState } from '@/domain'
import { LOCATION_STATUS, TEMPERATURE } from '@/lib/labels'

export type MapLayer = 'ocupacion' | 'temperatura' | 'rotacion' | 'caducidad' | 'familia'

export const LAYERS: { id: MapLayer; label: string }[] = [
  { id: 'ocupacion', label: 'Ocupación' },
  { id: 'temperatura', label: 'Temperatura' },
  { id: 'rotacion', label: 'Rotación' },
  { id: 'caducidad', label: 'Caducidad' },
  { id: 'familia', label: 'Familia de producto' },
]

export const CATEGORY_COLORS: Record<string, string> = {
  Quesos: '#f59e0b',
  Salmón: '#f97316',
  Piñas: '#16a34a',
  'Recipientes de plástico': '#2563eb',
}
const ROTATION_COLORS = { alta: '#16a34a', media: '#eab308', baja: '#f97316' }

const mix = (hex: string, pct: number) => {
  // mezcla el color con blanco según pct (0 = blanco, 1 = color)
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16)
  const f = (c: number) => Math.round(255 + (c - 255) * Math.max(0.25, Math.min(1, pct)))
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

export function fillForLayer(state: WarehouseState, loc: Location, layer: MapLayer): string {
  const st = locationStatus(state, loc)
  if (st === 'bloqueada') return 'url(#hatch)'
  if (loc.kind === 'muelle') return '#94a3b8'
  const occ = occupiedAt(state, loc.id)
  if (occ === 0) return LOCATION_STATUS.libre.fill
  const pct = occ / loc.capacity
  const entries = stockEntriesAt(state, loc.id)
  switch (layer) {
    case 'temperatura':
      return mix(TEMPERATURE[state.zones[loc.zoneId]?.temperature ?? 'ambiente'].color, 0.4 + pct * 0.6)
    case 'rotacion': {
      const main = entries.sort((a, b) => b.quantity - a.quantity)[0]
      const rot = main ? state.products[main.productId]?.rotation ?? 'media' : 'media'
      return mix(ROTATION_COLORS[rot], 0.45 + pct * 0.55)
    }
    case 'caducidad': {
      let worst = Infinity
      for (const e of entries) {
        const exp = state.products[e.productId]?.expiryDate
        if (exp) worst = Math.min(worst, (new Date(exp).getTime() - Date.now()) / 86400000)
      }
      if (!Number.isFinite(worst)) return '#cbd5e1'
      return worst < 7 ? '#dc2626' : worst < 15 ? '#f97316' : worst < 30 ? '#eab308' : '#86efac'
    }
    case 'familia': {
      const main = entries.sort((a, b) => b.quantity - a.quantity)[0]
      const cat = main ? state.products[main.productId]?.category ?? '' : ''
      return mix(CATEGORY_COLORS[cat] ?? '#64748b', 0.45 + pct * 0.55)
    }
    default: {
      const a = [147, 197, 253], b = [30, 58, 138]
      const c = a.map((v, i) => Math.round(v + (b[i] - v) * Math.min(1, pct)))
      return `rgb(${c[0]},${c[1]},${c[2]})`
    }
  }
}

export function legendForLayer(layer: MapLayer): { label: string; color: string; hatch?: boolean }[] {
  switch (layer) {
    case 'temperatura':
      return Object.entries(TEMPERATURE).map(([, v]) => ({ label: v.short, color: v.color }))
    case 'rotacion':
      return [{ label: 'Alta', color: ROTATION_COLORS.alta }, { label: 'Media', color: ROTATION_COLORS.media }, { label: 'Baja', color: ROTATION_COLORS.baja }]
    case 'caducidad':
      return [{ label: '< 7 días', color: '#dc2626' }, { label: '< 15 días', color: '#f97316' }, { label: '< 30 días', color: '#eab308' }, { label: '> 30 días', color: '#86efac' }, { label: 'Sin caducidad', color: '#cbd5e1' }]
    case 'familia':
      return Object.entries(CATEGORY_COLORS).map(([k, v]) => ({ label: k, color: v }))
    default:
      return [{ label: 'Libre', color: LOCATION_STATUS.libre.fill }, { label: 'Parcialmente ocupada', color: '#60a5fa' }, { label: 'Completa', color: '#1e3a8a' }, { label: 'Bloqueada', color: '#dc2626', hatch: true }]
  }
}

/** Ubicaciones con movimientos en los últimos `seconds` segundos (para el resaltado animado). */
export function recentlyChanged(state: WarehouseState, seconds = 20): Set<string> {
  const since = Date.now() - seconds * 1000
  const set = new Set<string>()
  for (const m of Object.values(state.movements)) {
    if (new Date(m.timestamp).getTime() < since || m.result !== 'ok') continue
    if (m.fromLocationId) set.add(m.fromLocationId)
    if (m.toLocationId) set.add(m.toLocationId)
  }
  return set
}
