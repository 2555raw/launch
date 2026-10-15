import { memo, type PointerEvent as RPointerEvent, type RefObject } from 'react'
import { AISLES, CORRIDOR_BOTTOM_Y, CORRIDOR_TOP_Y, MAP_H, MAP_W, aisleGeometry, locationStatus, occupiedAt, type Location, type RoutePoint, type WarehouseState, values } from '@/domain'
import { LOCATION_STATUS, ZONE_TYPE } from '@/lib/labels'
import { t } from '@/lib/i18n'
import { cx } from '@/lib/format'
import type { ViewBox } from './useViewBox'

export interface DragState { productId: string; fromLocationId: string; maxQty: number; overId: string | null; overReason: string | null; x: number; y: number }

interface Props {
  state: WarehouseState
  vb: ViewBox
  svgRef: RefObject<SVGSVGElement | null>
  selectedId: string | null
  hoverId: string | null
  matches: Set<string> | null
  route: RoutePoint[] | null
  routeStops: string[]
  drag: DragState | null
  showFlow: boolean
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  onLocationPointerDown: (loc: Location, e: RPointerEvent<SVGElement>) => void
  handlers: { onWheel: (e: React.WheelEvent<SVGSVGElement>) => void; onPointerDown: (e: RPointerEvent<SVGSVGElement>) => void; onPointerMove: (e: RPointerEvent<SVGSVGElement>) => void; onPointerUp: (e: RPointerEvent<SVGSVGElement>) => void }
}

function fillFor(state: WarehouseState, loc: Location) {
  const st = locationStatus(state, loc)
  if (st === 'bloqueada') return LOCATION_STATUS.bloqueada.fill
  if (st === 'libre') return LOCATION_STATUS.libre.fill
  const pct = occupiedAt(state, loc.id) / loc.capacity
  // Interpolación de azul claro a azul marino
  const a = [147, 197, 253], b = [30, 58, 138]
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * Math.min(1, pct)))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

function Truck({ x, y, dir, color, delay }: { x: number; y: number; dir: 'in' | 'out'; color: string; delay: number }) {
  return (
    <g transform={`translate(${x} ${y})`} style={{ animation: `truck 5s ease-in-out ${delay}s infinite` }}>
      <rect x="0" y="0" width="86" height="34" rx="4" fill={color} stroke="#0b1630" strokeWidth="1.5" />
      <rect x={dir === 'in' ? 86 : -18} y="8" width="18" height="26" rx="3" fill="#0b1630" />
      <rect x={dir === 'in' ? 90 : -14} y="12" width="8" height="8" rx="1" fill="#93c5fd" />
      <circle cx="16" cy="36" r="5" fill="#0b1630" /><circle cx="60" cy="36" r="5" fill="#0b1630" /><circle cx={dir === 'in' ? 96 : -10} cy="36" r="5" fill="#0b1630" />
      <text x="43" y="21" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="Inter, system-ui">{dir === 'in' ? t('ENTRADA') : t('SALIDA')}</text>
    </g>
  )
}

export const MapCanvas = memo(function MapCanvas({ state, vb, svgRef, selectedId, hoverId, matches, route, routeStops, drag, showFlow, onSelect, onHover, onLocationPointerDown, handlers }: Props) {
  const zoom = (MAP_W + 40) / vb.w
  const showQty = zoom > 2.2
  const showCodes = zoom > 3.4
  const locations = values(state.locations)
  const zones = values(state.zones)
  const pendingIn = values(state.receipts).filter((r) => ['pendiente', 'en_recepcion', 'control_calidad'].includes(r.status)).length
  const pendingOut = values(state.shipments).filter((s) => s.status === 'pendiente').length + values(state.orders).filter((o) => o.status === 'preparado').length
  const docksIn = locations.filter((l) => l.zoneId === 'Z-MDE').sort((a, b) => a.code.localeCompare(b.code))
  const docksOut = locations.filter((l) => l.zoneId === 'Z-MCA').sort((a, b) => a.code.localeCompare(b.code))
  const routeD = route && route.length > 1 ? route.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ') : null
  const flowD = `M ${docksIn[0]?.x ?? 100} 900 L 300 760 L 700 760 L 700 ${CORRIDOR_BOTTOM_Y} L 870 ${CORRIDOR_BOTTOM_Y} L 870 ${CORRIDOR_TOP_Y} L 1180 ${CORRIDOR_TOP_Y} L 1180 ${CORRIDOR_BOTTOM_Y} L 1440 ${CORRIDOR_BOTTOM_Y} L 1440 760 L 1230 760 L 1230 ${docksOut[1]?.y ?? 900}`

  return (
    <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="h-full w-full touch-none select-none bg-[#eef1f6]" {...handlers} onPointerLeave={handlers.onPointerUp}
      onClick={(e) => { if ((e.target as SVGElement).tagName === 'svg' || (e.target as SVGElement).dataset.bg) onSelect(null) }} role="application" aria-label={t('Plano del almacén')}>
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#dfe4ec" strokeWidth="1" /></pattern>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#fecaca" /><line x1="0" y1="0" x2="0" y2="8" stroke="#dc2626" strokeWidth="3" /></pattern>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316" /></marker>
        <marker id="arrow-flow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2f7cff" /></marker>
        <marker id="arrow-aisle" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" /></marker>
      </defs>
      {/* Nave */}
      <rect data-bg="1" x={-20} y={-20} width={MAP_W + 40} height={MAP_H + 40} fill="url(#grid)" />
      <rect data-bg="1" x={20} y={10} width={MAP_W - 40} height={MAP_H - 120} rx="6" fill="#f8fafc" stroke="#334155" strokeWidth="6" />
      {/* Zonas */}
      {zones.map((z) => {
        const zt = ZONE_TYPE[z.type]
        return (
          <g key={z.id} data-bg="1">
            <rect data-bg="1" x={z.x} y={z.y} width={z.w} height={z.h} rx="8" fill={zt.fill} stroke={zt.color} strokeWidth="1.5" strokeDasharray={z.type === 'oficinas' ? '6 4' : undefined} opacity={0.9} />
            <text className="svg-zone-label" x={z.x + 10} y={z.y + 16} fontSize="11" fill={zt.color}>{z.w < 300 ? `${t('Zona')} ${z.code}` : t(z.name)}</text>
            {z.temperature && z.temperature !== 'ambiente' && <text x={z.x + z.w - 10} y={z.w < 300 ? z.y + 30 : z.y + 16} fontSize="10" textAnchor="end" fontWeight="700" fill={zt.color} className="pointer-events-none">❄ {z.temperature === 'congelado' ? '-18 °C' : z.temperature === 'refrigerado' ? '0-4 °C' : '8-13 °C'}</text>}
          </g>
        )
      })}
      {/* Pasillos y sentido de circulación */}
      {Array.from({ length: AISLES }, (_, i) => i + 1).map((a) => {
        const g = aisleGeometry(a)
        const dir = a % 2 === 1 ? 1 : -1
        return (
          <g key={a} data-bg="1" className="pointer-events-none">
            <rect x={g.cx - 24} y={g.top} width={48} height={g.bottom - g.top} fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
            <line x1={g.cx} y1={dir === 1 ? g.bottom - 20 : g.top + 20} x2={g.cx} y2={dir === 1 ? g.top + 20 : g.bottom - 20} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" markerEnd="url(#arrow-aisle)" />
            <text x={g.cx} y={g.top - 6} textAnchor="middle" fontSize="12" fontWeight="800" fill="#1e3a8a" fontFamily="Inter, system-ui">P{String(a).padStart(2, '0')}</text>
            <text x={g.cx - 24 - 23} y={g.top - 6} textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="Inter, system-ui">{t('impares')}</text>
            <text x={g.cx + 24 + 23} y={g.top - 6} textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="Inter, system-ui">{t('pares')}</text>
          </g>
        )
      })}
      {/* Corredores principales */}
      <g data-bg="1" className="pointer-events-none">
        <rect x={40} y={CORRIDOR_TOP_Y - 14} width={1020} height={14} fill="#fff" opacity="0.7" />
        <rect x={40} y={CORRIDOR_BOTTOM_Y} width={1020} height={14} fill="#fff" opacity="0.7" />
      </g>
      {/* Capa de flujo en U */}
      {showFlow && (
        <g className="pointer-events-none">
          <path d={flowD} fill="none" stroke="#2f7cff" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" opacity="0.18" />
          <path d={flowD} fill="none" stroke="#2f7cff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" className="flow-path" markerEnd="url(#arrow-flow)" />
          {[['1', 150, 745, t('Recepción')], ['2', 690, 745, t('Calidad')], ['3', 870, 400, t('Almacenamiento')], ['4', 1180, 400, t('Picking')], ['5', 1440, 400, t('Consolidación')], ['6', 1230, 745, t('Expedición')]].map(([n, x, y, label]) => (
            <g key={String(n)}>
              <circle cx={Number(x)} cy={Number(y)} r="14" fill="#1d6ff2" stroke="#fff" strokeWidth="3" />
              <text x={Number(x)} y={Number(y) + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="Inter, system-ui">{n}</text>
              <text x={Number(x)} y={Number(y) + 30} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1d6ff2" fontFamily="Inter, system-ui">{label}</text>
            </g>
          ))}
        </g>
      )}
      {/* Ubicaciones */}
      {locations.map((loc) => {
        const st = locationStatus(state, loc)
        const occ = occupiedAt(state, loc.id)
        const isSel = selectedId === loc.id
        const dimmed = matches ? !matches.has(loc.id) && !isSel : false
        const isDropTarget = drag?.overId === loc.id
        const isSource = drag?.fromLocationId === loc.id
        const stop = routeStops.indexOf(loc.id)
        const fill = st === 'bloqueada' ? 'url(#hatch)' : loc.kind === 'muelle' ? '#cbd5e1' : fillFor(state, loc)
        return (
          <g key={loc.id} className={cx(dimmed && 'transition-opacity')}>
            <rect data-loc={loc.id} x={loc.x} y={loc.y} width={loc.w} height={loc.h} rx={loc.kind === 'estanteria' ? 1.5 : 4} fill={fill}
              stroke={isSource ? '#f97316' : hoverId === loc.id ? '#1d6ff2' : '#64748b'} strokeWidth={isSource ? 2 : 0.8}
              className={cx('map-location', isSel && 'selected', isDropTarget && (drag?.overReason ? 'drop-bad' : 'drop-ok'), stop >= 0 && 'highlight', dimmed && 'dimmed')}
              onPointerDown={(e) => onLocationPointerDown(loc, e)}
              onPointerEnter={() => onHover(loc.id)} onPointerLeave={() => onHover(null)}
              tabIndex={0} role="button" aria-label={`${loc.code} ${t(LOCATION_STATUS[st].label)} ${occ}/${loc.capacity}`}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(loc.id)}
            >
              <title>{loc.code} · {t(LOCATION_STATUS[st].label)} · {occ}/{loc.capacity} {t('uds')}</title>
            </rect>
            {loc.kind !== 'estanteria' && loc.kind !== 'muelle' && (
              <text x={loc.x + loc.w / 2} y={loc.y + loc.h / 2 + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill={st === 'completa' ? '#fff' : '#334155'} className="pointer-events-none" fontFamily="Inter, system-ui">{loc.code.replace(/-00-/, '-').replace(/-01$/, '')}</text>
            )}
            {loc.kind === 'muelle' && <text x={loc.x + loc.w / 2} y={loc.y + loc.h / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#1e293b" className="pointer-events-none" fontFamily="Inter, system-ui">M{loc.module}</text>}
            {showQty && loc.kind === 'estanteria' && occ > 0 && <text x={loc.x + loc.w / 2} y={loc.y + loc.h / 2 + 2.5} textAnchor="middle" fontSize="6.5" fontWeight="700" fill={occ / loc.capacity > 0.55 ? '#fff' : '#0b1630'} className="pointer-events-none" fontFamily="Inter, system-ui">{occ}</text>}
            {showCodes && loc.kind === 'estanteria' && <text x={loc.x + 1.5} y={loc.y + 5} fontSize="3.6" fill={occ / loc.capacity > 0.55 ? '#dbeafe' : '#475569'} className="pointer-events-none" fontFamily="Inter, system-ui">{loc.code}</text>}
            {stop >= 0 && (
              <g className="pointer-events-none">
                <circle cx={loc.x + loc.w / 2} cy={loc.y + loc.h / 2} r="9" fill="#f97316" stroke="#fff" strokeWidth="2" />
                <text x={loc.x + loc.w / 2} y={loc.y + loc.h / 2 + 3.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily="Inter, system-ui">{stop + 1}</text>
              </g>
            )}
          </g>
        )
      })}
      {/* Etiquetas de módulos (estanterías) */}
      {zoom > 1.6 && locations.filter((l) => l.kind === 'estanteria' && l.level === 1 && l.aisle > 0 && l.zoneId !== 'Z-PCK').map((l) => (
        <text key={l.id + 'm'} x={l.x + l.w / 2} y={l.y + l.h + 7} textAnchor="middle" fontSize="5" fill="#64748b" className="pointer-events-none" fontFamily="Inter, system-ui">{l.code.slice(0, -3)}</text>
      ))}
      {/* Camiones en muelles */}
      {docksIn.map((d, i) => i < Math.max(1, pendingIn) && <Truck key={d.id} x={d.x - 6} y={d.y + 60} dir="in" color="#2563eb" delay={i * 0.7} />)}
      {docksOut.map((d, i) => i < pendingOut && <Truck key={d.id} x={d.x + 6} y={d.y + 60} dir="out" color="#16a34a" delay={i * 0.9} />)}
      {/* Ruta */}
      {routeD && (
        <g className="pointer-events-none">
          <path d={routeD} fill="none" stroke="#f97316" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" opacity="0.2" />
          <path d={routeD} fill="none" stroke="#f97316" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="route-path" markerEnd="url(#arrow)" />
          <circle cx={route![0].x} cy={route![0].y} r="7" fill="#f97316" stroke="#fff" strokeWidth="2" />
        </g>
      )}
      {/* Fantasma de arrastre */}
      {drag && (
        <g className="pointer-events-none" transform={`translate(${drag.x} ${drag.y})`}>
          <circle r="22" fill="#1d6ff2" opacity="0.15" className="animate-pulse-ring" />
          <rect x="-30" y="-14" width="60" height="28" rx="6" fill="#0b1630" opacity="0.92" />
          <text x="0" y="-2" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="Inter, system-ui">{state.products[drag.productId]?.sku}</text>
          <text x="0" y="9" textAnchor="middle" fontSize="8" fill="#93c5fd" fontFamily="Inter, system-ui">{drag.maxQty} {t('uds')}</text>
          {drag.overReason && <text x="0" y="28" textAnchor="middle" fontSize="8" fontWeight="700" fill="#dc2626" fontFamily="Inter, system-ui">✕ {drag.overReason}</text>}
          {drag.overId && !drag.overReason && <text x="0" y="28" textAnchor="middle" fontSize="8" fontWeight="700" fill="#16a34a" fontFamily="Inter, system-ui">✓ {state.locations[drag.overId]?.code}</text>}
        </g>
      )}
      {/* Rosa de orientación */}
      <g className="pointer-events-none" transform={`translate(${MAP_W - 60} ${MAP_H - 40})`}>
        <text x="0" y="0" textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="Inter, system-ui">{t('Frente de muelles')}</text>
      </g>
    </svg>
  )
})
