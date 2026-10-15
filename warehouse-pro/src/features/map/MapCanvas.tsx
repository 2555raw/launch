import { memo, type PointerEvent as RPointerEvent, type RefObject } from 'react'
import { AISLES, CORRIDOR_BOTTOM_Y, CORRIDOR_TOP_Y, MAP_H, MAP_W, MODULES_PER_SIDE, aisleGeometry, locationStatus, occupiedAt, type Location, type RoutePoint, type WarehouseState, values } from '@/domain'
import { LOCATION_STATUS, ZONE_TYPE } from '@/lib/labels'
import { t } from '@/lib/i18n'
import { cx } from '@/lib/format'
import type { ViewBox } from './useViewBox'
import { fillForLayer, type MapLayer } from './layers'

import type { DragState } from './MapCanvas3D'

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
  layer: MapLayer
  recent: Set<string>
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  onLocationPointerDown: (loc: Location, e: RPointerEvent<SVGElement>) => void
  handlers: { onWheel: (e: React.WheelEvent<SVGSVGElement>) => void; onPointerDown: (e: RPointerEvent<SVGSVGElement>) => void; onPointerMove: (e: RPointerEvent<SVGSVGElement>) => void; onPointerUp: (e: RPointerEvent<SVGSVGElement>) => void }
}

const FONT = 'Inter, system-ui'

function Truck({ x, y, dir, color, delay }: { x: number; y: number; dir: 'in' | 'out'; color: string; delay: number }) {
  return (
    <g transform={`translate(${x} ${y})`} style={{ animation: `truck 5s ease-in-out ${delay}s infinite` }}>
      <rect x="0" y="0" width="86" height="34" rx="4" fill={color} stroke="#0b1630" strokeWidth="1.5" />
      <rect x="4" y="4" width="78" height="26" rx="2" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" />
      <rect x={dir === 'in' ? 86 : -18} y="8" width="18" height="26" rx="3" fill="#0b1630" />
      <rect x={dir === 'in' ? 90 : -14} y="12" width="8" height="8" rx="1" fill="#93c5fd" />
      <circle cx="16" cy="36" r="5" fill="#0b1630" /><circle cx="60" cy="36" r="5" fill="#0b1630" /><circle cx={dir === 'in' ? 96 : -10} cy="36" r="5" fill="#0b1630" />
      <text x="43" y="21" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily={FONT}>{dir === 'in' ? t('ENTRADA') : t('SALIDA')}</text>
    </g>
  )
}

function Forklift({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y})`} style={{ animation: `truck 4s ease-in-out ${delay}s infinite` }} className="pointer-events-none">
      <rect x="0" y="4" width="22" height="16" rx="3" fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
      <rect x="4" y="0" width="10" height="8" rx="2" fill="#78350f" />
      <rect x="22" y="2" width="3" height="20" fill="#475569" /><rect x="25" y="18" width="14" height="2.5" fill="#475569" />
      <circle cx="5" cy="21" r="3" fill="#1e293b" /><circle cx="17" cy="21" r="3" fill="#1e293b" />
    </g>
  )
}

function ZoneSign({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  const w = Math.min(380, text.length * 6.6 + 22)
  return (
    <g className="pointer-events-none">
      <rect x={x} y={y} width={w} height={20} rx="5" fill="#ffffff" fillOpacity="0.92" stroke={color} strokeWidth="1" />
      <rect x={x} y={y} width={5} height={20} rx="2" fill={color} />
      <text x={x + 12} y={y + 14} fontSize="10.5" fontWeight="700" fill={color} fontFamily={FONT} letterSpacing="0.6">{text.toUpperCase()}</text>
    </g>
  )
}

export const MapCanvas = memo(function MapCanvas({ state, vb, svgRef, selectedId, hoverId, matches, route, routeStops, drag, showFlow, layer, recent, onSelect, onHover, onLocationPointerDown, handlers }: Props) {
  const zoom = (MAP_W + 40) / vb.w
  const showQty = zoom > 2.2
  const showCodes = zoom > 3.4
  const locations = values(state.locations)
  const zones = values(state.zones)
  const pendingIn = values(state.receipts).filter((r) => ['pendiente', 'en_recepcion', 'control_calidad'].includes(r.status)).length
  const pendingOut = values(state.shipments).filter((s) => s.status === 'pendiente').length + values(state.orders).filter((o) => o.status === 'preparado').length
  const activePicks = values(state.orders).filter((o) => ['en_preparacion', 'parcialmente_preparado'].includes(o.status)).length
  const docksIn = locations.filter((l) => l.zoneId === 'Z-MDE').sort((a, b) => a.code.localeCompare(b.code))
  const docksOut = locations.filter((l) => l.zoneId === 'Z-MCA').sort((a, b) => a.code.localeCompare(b.code))
  const routeD = route && route.length > 1 ? route.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ') : null
  const flowD = `M ${docksIn[0]?.x ?? 100} 900 L 300 760 L 700 760 L 700 ${CORRIDOR_BOTTOM_Y} L 870 ${CORRIDOR_BOTTOM_Y} L 870 ${CORRIDOR_TOP_Y} L 1180 ${CORRIDOR_TOP_Y} L 1180 ${CORRIDOR_BOTTOM_Y} L 1440 ${CORRIDOR_BOTTOM_Y} L 1440 760 L 1230 760 L 1230 ${docksOut[1]?.y ?? 900}`
  // Módulos (agrupación de 4 niveles) para dibujar la estructura de las estanterías
  const modules = new Map<string, Location[]>()
  for (const l of locations) if (l.kind === 'estanteria' && l.aisle > 0 && l.zoneId !== 'Z-PCK') { const k = `${l.zoneId}-${l.aisle}-${l.module}`; modules.set(k, [...(modules.get(k) ?? []), l]) }

  return (
    <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="h-full w-full touch-none select-none bg-[#e6eaf1]" {...handlers} onPointerLeave={handlers.onPointerUp}
      onClick={(e) => { if ((e.target as SVGElement).tagName === 'svg' || (e.target as SVGElement).dataset.bg) onSelect(null) }} role="application" aria-label={t('Plano del almacén')}>
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d7dde8" strokeWidth="1" /></pattern>
        <pattern id="concrete" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#f8fafc" /><circle cx="3" cy="4" r="0.6" fill="#e2e8f0" /><circle cx="9" cy="9" r="0.6" fill="#e2e8f0" /></pattern>
        <pattern id="asphalt" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#cbd5e1" /><circle cx="2" cy="7" r="0.7" fill="#b6c0cf" /><circle cx="7" cy="2" r="0.7" fill="#b6c0cf" /></pattern>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#fecaca" /><line x1="0" y1="0" x2="0" y2="8" stroke="#dc2626" strokeWidth="3" /></pattern>
        <pattern id="bumper" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#facc15" /><line x1="0" y1="0" x2="0" y2="8" stroke="#1e293b" strokeWidth="3" /></pattern>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316" /></marker>
        <marker id="arrow-flow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2f7cff" /></marker>
        <marker id="arrow-aisle" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" /></marker>
      </defs>
      {/* Parcela y patio de maniobras */}
      <rect data-bg="1" x={-20} y={-20} width={MAP_W + 40} height={MAP_H + 40} fill="url(#grid)" />
      <rect data-bg="1" x={20} y={MAP_H - 115} width={MAP_W - 40} height={120} rx="4" fill="url(#asphalt)" />
      {[0, 1, 2].map((i) => <line key={i} x1={40} y1={MAP_H - 95 + i * 36} x2={MAP_W - 20} y2={MAP_H - 95 + i * 36} stroke="#f8fafc" strokeWidth="2" strokeDasharray="18 14" className="pointer-events-none" />)}
      <text x={MAP_W / 2} y={MAP_H - 8} textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b" fontFamily={FONT} letterSpacing="2" className="pointer-events-none">{t('PATIO DE MANIOBRAS · FRENTE DE MUELLES').toUpperCase()}</text>
      {/* Nave */}
      <rect data-bg="1" className="map-building" x={20} y={10} width={MAP_W - 40} height={MAP_H - 120} rx="6" fill="url(#concrete)" stroke="#1e293b" strokeWidth="8" />
      <rect data-bg="1" x={26} y={16} width={MAP_W - 52} height={MAP_H - 132} rx="4" fill="none" stroke="#94a3b8" strokeWidth="1" />
      {/* Pilares estructurales */}
      {[250, 450, 650, 850, 1050, 1250, 1450].map((x) => [160, 660].map((y) => <rect key={`${x}-${y}`} x={x - 5} y={y - 5} width={10} height={10} fill="#64748b" className="pointer-events-none" />))}
      {/* Zonas */}
      {zones.map((z) => {
        const zt = ZONE_TYPE[z.type]
        const isDock = z.type === 'muelles_entrada' || z.type === 'muelles_salida'
        return (
          <g key={z.id} data-bg="1">
            <rect data-bg="1" x={z.x} y={z.y} width={z.w} height={z.h} rx="8" fill={isDock ? '#475569' : zt.fill} stroke={isDock ? '#1e293b' : zt.color} strokeWidth="1.5" strokeDasharray={z.type === 'oficinas' ? '6 4' : undefined} opacity={0.92} />
            {!isDock && <ZoneSign x={z.x + 8} y={z.y + 6} text={z.w < 300 ? `${t('Zona')} ${z.code}` : t(z.name)} color={zt.color} />}
            {isDock && <text x={z.x + 10} y={z.y + 16} fontSize="10" fontWeight="700" fill="#f8fafc" fontFamily={FONT} letterSpacing="1" className="pointer-events-none">{t(z.name).toUpperCase()}</text>}
            {z.temperature && z.temperature !== 'ambiente' && <text x={z.x + z.w - 10} y={z.w < 300 ? z.y + 42 : z.y + 20} fontSize="10" textAnchor="end" fontWeight="700" fill={zt.color} className="pointer-events-none" fontFamily={FONT}>❄ {z.temperature === 'congelado' ? '-18 °C' : z.temperature === 'refrigerado' ? '0-4 °C' : '8-13 °C'}</text>}
            {z.type === 'oficinas' && <text x={z.x + z.w / 2} y={z.y + z.h / 2 + 4} fontSize="11" textAnchor="middle" fill="#94a3b8" fontFamily={FONT} className="pointer-events-none">{t('Oficina de almacén · vestuarios · acceso peatonal segregado')}</text>}
          </g>
        )
      })}
      {/* Corredores principales con marcas viales */}
      <g data-bg="1" className="pointer-events-none">
        {[CORRIDOR_TOP_Y - 14, CORRIDOR_BOTTOM_Y].map((y) => (
          <g key={y}>
            <rect x={40} y={y} width={1020} height={14} fill="#fff" opacity="0.75" />
            <line x1={48} y1={y + 7} x2={1052} y2={y + 7} stroke="#facc15" strokeWidth="1.5" strokeDasharray="14 10" />
          </g>
        ))}
        {/* Pasillo peatonal segregado junto a oficinas */}
        <line x1={1070} y1={150} x2={1560} y2={150} stroke="#16a34a" strokeWidth="2" strokeDasharray="4 6" />
      </g>
      {/* Pasillos: suelo, línea central, sentido y cartel */}
      {Array.from({ length: AISLES }, (_, i) => i + 1).map((a) => {
        const g = aisleGeometry(a)
        const dir = a % 2 === 1 ? 1 : -1
        const y1 = dir === 1 ? g.bottom - 24 : g.top + 24, y2 = dir === 1 ? g.top + 24 : g.bottom - 24
        return (
          <g key={a} data-bg="1" className="pointer-events-none">
            <rect x={g.cx - 24} y={g.top} width={48} height={g.bottom - g.top} fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
            <line x1={g.cx - 21} y1={g.top + 4} x2={g.cx - 21} y2={g.bottom - 4} stroke="#facc15" strokeWidth="1" /><line x1={g.cx + 21} y1={g.top + 4} x2={g.cx + 21} y2={g.bottom - 4} stroke="#facc15" strokeWidth="1" />
            <line x1={g.cx} y1={y1} x2={g.cx} y2={y2} stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 6" markerEnd="url(#arrow-aisle)" />
            <rect x={g.cx - 18} y={g.top - 19} width={36} height={16} rx="4" fill="#1e3a8a" />
            <text x={g.cx} y={g.top - 7} textAnchor="middle" fontSize="11" fontWeight="800" fill="#ffffff" fontFamily={FONT}>P{String(a).padStart(2, '0')}</text>
            <text x={g.cx - 24 - 23} y={g.top - 6} textAnchor="middle" fontSize="7.5" fill="#64748b" fontFamily={FONT}>{t('impares')}</text>
            <text x={g.cx + 24 + 23} y={g.top - 6} textAnchor="middle" fontSize="7.5" fill="#64748b" fontFamily={FONT}>{t('pares')}</text>
          </g>
        )
      })}
      {/* Estructura de los módulos de estantería (bastidor y largueros) */}
      {[...modules.entries()].map(([k, ls]) => {
        const x = Math.min(...ls.map((l) => l.x)), y = Math.min(...ls.map((l) => l.y)) - 3
        const w = ls[0].w, h = Math.max(...ls.map((l) => l.y + l.h)) - y + 3
        return (
          <g key={k} className="pointer-events-none">
            <rect x={x - 1.5} y={y} width={w + 3} height={h} rx="1.5" fill="#f1f5f9" stroke="#475569" strokeWidth="1.4" />
            <line x1={x - 1.5} y1={y} x2={x - 1.5} y2={y + h} stroke="#f97316" strokeWidth="1.6" /><line x1={x + w + 1.5} y1={y} x2={x + w + 1.5} y2={y + h} stroke="#f97316" strokeWidth="1.6" />
          </g>
        )
      })}
      {/* Capa de flujo en U */}
      {showFlow && (
        <g className="pointer-events-none">
          <path d={flowD} fill="none" stroke="#2f7cff" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" opacity="0.18" />
          <path d={flowD} fill="none" stroke="#2f7cff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" className="flow-path" markerEnd="url(#arrow-flow)" />
          {[['1', 150, 745, t('Recepción')], ['2', 690, 745, t('Calidad')], ['3', 870, 400, t('Almacenamiento')], ['4', 1180, 400, t('Picking')], ['5', 1440, 400, t('Consolidación')], ['6', 1230, 745, t('Expedición')]].map(([n, x, y, label]) => (
            <g key={String(n)}>
              <circle cx={Number(x)} cy={Number(y)} r="14" fill="#1d6ff2" stroke="#fff" strokeWidth="3" />
              <text x={Number(x)} y={Number(y) + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily={FONT}>{n}</text>
              <text x={Number(x)} y={Number(y) + 30} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1d6ff2" fontFamily={FONT}>{label}</text>
            </g>
          ))}
        </g>
      )}
      {/* Puertas de muelle con topes */}
      {[...docksIn, ...docksOut].map((d) => (
        <g key={d.id + 'door'} className="pointer-events-none">
          <rect x={d.x + 10} y={d.y - 6} width={d.w - 20} height={6} fill="url(#bumper)" />
          <rect x={d.x + 14} y={d.y + d.h - 4} width={d.w - 28} height={4} rx="1" fill="#0f172a" />
        </g>
      ))}
      {/* Ubicaciones */}
      {locations.map((loc) => {
        const st = locationStatus(state, loc)
        const occ = occupiedAt(state, loc.id)
        const isSel = selectedId === loc.id
        const dimmed = matches ? !matches.has(loc.id) && !isSel : false
        const isDropTarget = drag?.overId === loc.id
        const isSource = drag?.fromLocationId === loc.id
        const stop = routeStops.indexOf(loc.id)
        const fill = fillForLayer(state, loc, layer)
        const dark = st !== 'libre' && st !== 'bloqueada' && (layer !== 'ocupacion' ? occ / loc.capacity > 0.6 : occ / loc.capacity > 0.55)
        return (
          <g key={loc.id}>
            <rect data-loc={loc.id} x={loc.x} y={loc.y} width={loc.w} height={loc.h} rx={loc.kind === 'estanteria' ? 1.5 : 4} fill={fill}
              stroke={isSource ? '#f97316' : hoverId === loc.id ? '#1d6ff2' : loc.kind === 'muelle' ? '#1e293b' : '#64748b'} strokeWidth={isSource ? 2 : 0.8}
              className={cx('map-location', isSel && 'selected', isDropTarget && (drag?.overReason ? 'drop-bad' : 'drop-ok'), stop >= 0 && 'highlight', dimmed && 'dimmed', recent.has(loc.id) && !isSel && 'recent')}
              onPointerDown={(e) => onLocationPointerDown(loc, e)}
              onPointerEnter={() => onHover(loc.id)} onPointerLeave={() => onHover(null)}
              tabIndex={0} role="button" aria-label={`${loc.code} ${t(LOCATION_STATUS[st].label)} ${occ}/${loc.capacity}`}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(loc.id)}
            >
              <title>{loc.code} · {t(LOCATION_STATUS[st].label)} · {occ}/{loc.capacity} {t('uds')}</title>
            </rect>
            {loc.kind !== 'estanteria' && loc.kind !== 'muelle' && (
              <text x={loc.x + loc.w / 2} y={loc.y + loc.h / 2 + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill={dark ? '#fff' : '#334155'} className="pointer-events-none" fontFamily={FONT}>{loc.code.replace(/-00-/, '-').replace(/-01$/, '')}</text>
            )}
            {loc.kind !== 'estanteria' && loc.kind !== 'muelle' && occ > 0 && <text x={loc.x + loc.w / 2} y={loc.y + loc.h / 2 + 15} textAnchor="middle" fontSize="8" fill={dark ? '#dbeafe' : '#64748b'} className="pointer-events-none" fontFamily={FONT}>{occ}/{loc.capacity}</text>}
            {loc.kind === 'muelle' && <text x={loc.x + loc.w / 2} y={loc.y + loc.h / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#0f172a" className="pointer-events-none" fontFamily={FONT}>M{loc.module}</text>}
            {showQty && loc.kind === 'estanteria' && occ > 0 && <text x={loc.x + loc.w / 2} y={loc.y + loc.h / 2 + 2.5} textAnchor="middle" fontSize="6.5" fontWeight="700" fill={dark ? '#fff' : '#0b1630'} className="pointer-events-none" fontFamily={FONT}>{occ}</text>}
            {showCodes && loc.kind === 'estanteria' && <text x={loc.x + 1.5} y={loc.y + 5} fontSize="3.6" fill={dark ? '#dbeafe' : '#475569'} className="pointer-events-none" fontFamily={FONT}>{loc.code}</text>}
            {stop >= 0 && (
              <g className="pointer-events-none">
                <circle cx={loc.x + loc.w / 2} cy={loc.y + loc.h / 2} r="9" fill="#f97316" stroke="#fff" strokeWidth="2" />
                <text x={loc.x + loc.w / 2} y={loc.y + loc.h / 2 + 3.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily={FONT}>{stop + 1}</text>
              </g>
            )}
          </g>
        )
      })}
      {/* Etiquetas de módulos */}
      {zoom > 1.6 && [...modules.values()].map((ls) => { const l = ls.find((x) => x.level === 1) ?? ls[0]; return <text key={l.id + 'm'} x={l.x + l.w / 2} y={l.y + l.h + 7} textAnchor="middle" fontSize="5" fill="#64748b" className="pointer-events-none" fontFamily={FONT}>{l.code.slice(0, -3)}</text> })}
      {/* Carretillas en actividad de picking */}
      {activePicks > 0 && <Forklift x={1185 - 11} y={CORRIDOR_BOTTOM_Y - 6} delay={0} />}
      {pendingIn > 0 && <Forklift x={300} y={700} delay={1.3} />}
      {/* Camiones en muelles */}
      {docksIn.map((d, i) => i < Math.max(1, pendingIn) && <Truck key={d.id} x={d.x + 36} y={d.y + 60} dir="in" color="#2563eb" delay={i * 0.7} />)}
      {docksOut.map((d, i) => i < pendingOut && <Truck key={d.id} x={d.x + 44} y={d.y + 60} dir="out" color="#16a34a" delay={i * 0.9} />)}
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
          <text x="0" y="-2" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily={FONT}>{state.products[drag.productId]?.sku}</text>
          <text x="0" y="9" textAnchor="middle" fontSize="8" fill="#93c5fd" fontFamily={FONT}>{drag.maxQty} {t('uds')}</text>
          {drag.overReason && <text x="0" y="28" textAnchor="middle" fontSize="8" fontWeight="700" fill="#dc2626" fontFamily={FONT}>✕ {drag.overReason}</text>}
          {drag.overId && !drag.overReason && <text x="0" y="28" textAnchor="middle" fontSize="8" fontWeight="700" fill="#16a34a" fontFamily={FONT}>✓ {state.locations[drag.overId]?.code}</text>}
        </g>
      )}
      {/* Escala y norte */}
      <g className="pointer-events-none" transform={`translate(${MAP_W - 150} 40)`}>
        <line x1="0" y1="0" x2="100" y2="0" stroke="#334155" strokeWidth="2" /><line x1="0" y1="-4" x2="0" y2="4" stroke="#334155" strokeWidth="2" /><line x1="100" y1="-4" x2="100" y2="4" stroke="#334155" strokeWidth="2" />
        <text x="50" y="14" textAnchor="middle" fontSize="9" fill="#334155" fontFamily={FONT}>5 m</text>
        <circle cx="125" cy="4" r="9" fill="#fff" stroke="#334155" strokeWidth="1.5" /><path d="M125 -3 L128 7 L125 5 L122 7 Z" fill="#1e3a8a" /><text x="125" y="26" textAnchor="middle" fontSize="8" fontWeight="700" fill="#334155" fontFamily={FONT}>N</text>
      </g>
    </svg>
  )
})

export { MODULES_PER_SIDE }
