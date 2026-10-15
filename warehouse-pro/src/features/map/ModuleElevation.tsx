import { locationStatus, occupiedAt, stockEntriesAt, values, type Location, type WarehouseState } from '@/domain'
import { LOCATION_STATUS } from '@/lib/labels'
import { t } from '@/lib/i18n'
import { cx } from '@/lib/format'

/** Vista en alzado del módulo de estantería: los cuatro niveles del hueco seleccionado. */
export function ModuleElevation({ state, loc, onSelect }: { state: WarehouseState; loc: Location; onSelect: (id: string) => void }) {
  const levels = values(state.locations).filter((l) => l.zoneId === loc.zoneId && l.aisle === loc.aisle && l.module === loc.module && l.kind === 'estanteria').sort((a, b) => b.level - a.level)
  if (levels.length < 2) return null
  const W = 300, H = 170, shelf = (H - 20) / levels.length
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500"><span>{t('Alzado del módulo')} {loc.code.slice(0, -3)}</span><span>{t('Nivel')} {loc.level}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="list">
        <rect x="8" y="4" width="6" height={H - 8} fill="#f97316" /><rect x={W - 14} y="4" width="6" height={H - 8} fill="#f97316" />
        {levels.map((l, i) => {
          const y = 8 + i * shelf
          const occ = occupiedAt(state, l.id)
          const st = locationStatus(state, l)
          const pct = Math.min(1, occ / l.capacity)
          const entries = stockEntriesAt(state, l.id)
          const sel = l.id === loc.id
          const boxes = Math.min(8, Math.ceil(pct * 8))
          return (
            <g key={l.id} role="listitem" className="cursor-pointer" onClick={() => onSelect(l.id)}>
              <rect x="16" y={y} width={W - 32} height={shelf - 6} rx="2" fill={sel ? '#e3eeff' : '#ffffff'} stroke={sel ? '#1d6ff2' : '#cbd5e1'} strokeWidth={sel ? 2 : 1} />
              <rect x="16" y={y + shelf - 8} width={W - 32} height="3" fill="#475569" />
              {st === 'bloqueada' ? <rect x="20" y={y + 4} width={W - 40} height={shelf - 16} fill="url(#hatch)" opacity="0.8" rx="2" /> :
                Array.from({ length: boxes }, (_, b) => <rect key={b} x={22 + b * 30} y={y + 6} width="24" height={shelf - 20} rx="2" fill={pct >= 1 ? '#1e3a8a' : '#60a5fa'} stroke="#1e3a8a" strokeWidth="0.8" />)}
              <text x={W - 40} y={y + 15} textAnchor="end" fontSize="10" fontWeight="700" fill="#0b1630" fontFamily="Inter, system-ui">N{l.level}</text>
              <text x={W - 40} y={y + 27} textAnchor="end" fontSize="8" fill="#475569" fontFamily="Inter, system-ui">{occ}/{l.capacity}</text>
              {entries[0] && <text x="22" y={y + shelf - 11} fontSize="7" fill="#334155" fontFamily="Inter, system-ui">{state.products[entries[0].productId]?.sku}{entries.length > 1 ? ` +${entries.length - 1}` : ''}</text>}
              <title>{l.code} · {t(LOCATION_STATUS[st].label)}</title>
            </g>
          )
        })}
      </svg>
      <p className={cx('mt-1 text-[10px] text-slate-400')}>{t('Pulsa un nivel para seleccionarlo. Nivel 1 abajo (suelo), nivel 4 arriba.')}</p>
    </div>
  )
}
