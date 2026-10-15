import { memo, type PointerEvent as RPointerEvent, type RefObject, type ReactNode } from 'react'
import { AISLES, CORRIDOR_BOTTOM_Y, CORRIDOR_TOP_Y, MAP_H, MAP_W, aisleGeometry, locationStatus, occupiedAt, stockEntriesAt, type Location, type RoutePoint, type WarehouseState, values } from '@/domain'
import { LOCATION_STATUS, ZONE_TYPE } from '@/lib/labels'
import { t } from '@/lib/i18n'
import { cx } from '@/lib/format'
import type { ViewBox } from './useViewBox'
import { fillForLayer, type MapLayer } from './layers'
import { boxFaces, floorPoly, iso, pts, shade } from './projection'

export interface DragState { productId: string; fromLocationId: string; maxQty: number; overId: string | null; overReason: string | null; x: number; y: number }

export interface CanvasProps {
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
const LEVEL_H = 11
const WALL_H = 46

interface Item { depth: number; node: ReactNode }

/** Caja volumétrica decorativa (sin eventos de puntero). */
function Box({ x, y, w, d, h, z0 = 0, color, stroke = 'rgba(15,23,42,0.35)', opacity = 1, topColor }: { x: number; y: number; w: number; d: number; h: number; z0?: number; color: string; stroke?: string; opacity?: number; topColor?: string }) {
  const f = boxFaces(x, y, w, d, h, z0)
  return (
    <g className="pointer-events-none" opacity={opacity}>
      <polygon points={f.south} fill={shade(color, 0.62)} stroke={stroke} strokeWidth="0.6" />
      <polygon points={f.east} fill={shade(color, 0.8)} stroke={stroke} strokeWidth="0.6" />
      <polygon points={f.top} fill={topColor ?? color} stroke={stroke} strokeWidth="0.6" />
    </g>
  )
}

function Label({ x, y, z = 0, text, size = 10, color = '#334155', weight = 700, anchor = 'middle', bg }: { x: number; y: number; z?: number; text: string; size?: number; color?: string; weight?: number; anchor?: 'middle' | 'start' | 'end'; bg?: string }) {
  const p = iso(x, y, z)
  const w = text.length * size * 0.62 + 10
  return (
    <g className="pointer-events-none">
      {bg && <rect x={anchor === 'middle' ? p.X - w / 2 : anchor === 'start' ? p.X - 5 : p.X - w + 5} y={p.Y - size - 2} width={w} height={size + 7} rx="4" fill={bg} fillOpacity="0.95" />}
      <text x={p.X} y={p.Y} textAnchor={anchor} fontSize={size} fontWeight={weight} fill={color} fontFamily={FONT}>{text}</text>
    </g>
  )
}

function Truck3D({ x, y, dir, color, delay }: { x: number; y: number; dir: 'in' | 'out'; color: string; delay: number }) {
  const cabX = dir === 'in' ? x + 70 : x - 20
  return (
    <g className="pointer-events-none" style={{ animation: `truck 5s ease-in-out ${delay}s infinite` }}>
      <polygon points={floorPoly(x - 4, y - 2, 100, 40)} fill="rgba(15,23,42,0.18)" />
      <Box x={x} y={y + 3} w={70} d={30} h={30} z0={6} color={color} topColor={shade(color, 1.12)} />
      <Box x={cabX} y={y + 5} w={20} d={26} h={22} z0={6} color="#0b1630" topColor="#1e293b" />
      <Box x={cabX + (dir === 'in' ? 14 : 0)} y={y + 8} w={6} d={20} h={10} z0={16} color="#93c5fd" stroke="none" />
      {[8, 56].map((wx) => <Box key={wx} x={x + wx} y={y + 2} w={8} d={32} h={6} color="#0b1630" stroke="none" />)}
      <Label x={x + 35} y={y + 18} z={40} text={dir === 'in' ? t('ENTRADA') : t('SALIDA')} size={8} color="#fff" />
    </g>
  )
}

function Forklift3D({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g className="pointer-events-none" style={{ animation: `truck 4s ease-in-out ${delay}s infinite` }}>
      <polygon points={floorPoly(x - 2, y - 2, 26, 22)} fill="rgba(15,23,42,0.18)" />
      <Box x={x} y={y} w={20} d={16} h={10} z0={3} color="#f59e0b" />
      <Box x={x + 4} y={y + 3} w={8} d={10} h={10} z0={13} color="#78350f" />
      <Box x={x + 20} y={y + 7} w={2} d={2} h={24} z0={3} color="#475569" stroke="none" />
      <Box x={x + 22} y={y + 2} w={12} d={12} h={1.5} z0={3} color="#64748b" stroke="none" />
    </g>
  )
}

export const MapCanvas3D = memo(function MapCanvas3D({ state, vb, svgRef, selectedId, hoverId, matches, route, routeStops, drag, showFlow, layer, recent, onSelect, onHover, onLocationPointerDown, handlers }: CanvasProps) {
  const zoom = 2340 / vb.w
  const showQty = zoom > 2.4
  const showCodes = zoom > 3.6
  const locations = values(state.locations)
  const zones = values(state.zones)
  const pendingIn = values(state.receipts).filter((r) => ['pendiente', 'en_recepcion', 'control_calidad'].includes(r.status)).length
  const pendingOut = values(state.shipments).filter((s) => s.status === 'pendiente').length + values(state.orders).filter((o) => o.status === 'preparado').length
  const activePicks = values(state.orders).filter((o) => ['en_preparacion', 'parcialmente_preparado'].includes(o.status)).length
  const docksIn = locations.filter((l) => l.zoneId === 'Z-MDE').sort((a, b) => a.code.localeCompare(b.code))
  const docksOut = locations.filter((l) => l.zoneId === 'Z-MCA').sort((a, b) => a.code.localeCompare(b.code))
  const items: Item[] = []
  const push = (depth: number, node: ReactNode) => items.push({ depth, node })

  // Módulos de estantería → bastidores
  const modules = new Map<string, Location[]>()
  for (const l of locations) if (l.kind === 'estanteria' && l.aisle > 0 && l.zoneId !== 'Z-PCK') { const k = `${l.zoneId}-${l.aisle}-${l.module}`; modules.set(k, [...(modules.get(k) ?? []), l]) }
  for (const [k, ls] of modules) {
    const x = Math.min(...ls.map((l) => l.x)), y = Math.min(...ls.map((l) => l.y)) - 3, w = ls[0].w, d = Math.max(...ls.map((l) => l.y + l.h)) - y + 3
    push(x + y, <polygon key={k + 'f'} points={floorPoly(x - 2, y - 2, w + 4, d + 4)} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" className="pointer-events-none" />)
    for (const [ux, uy] of [[x - 2, y - 2], [x + w, y - 2], [x - 2, y + d], [x + w, y + d]]) push(ux + uy + 2, <Box key={`${k}-${ux}-${uy}`} x={ux} y={uy} w={2} d={2} h={LEVEL_H + 9} color="#f97316" stroke="none" />)
    // Larguero superior trasero
    push(x + w + y, <Box key={k + 'b'} x={x - 2} y={y - 2} w={w + 4} d={1.2} h={1.5} z0={LEVEL_H + 8} color="#fb923c" stroke="none" />)
  }

  // Ubicaciones
  for (const loc of locations) {
    const st = locationStatus(state, loc)
    const occ = occupiedAt(state, loc.id)
    const isSel = selectedId === loc.id
    const dimmed = matches ? !matches.has(loc.id) && !isSel : false
    const isDropTarget = drag?.overId === loc.id
    const isSource = drag?.fromLocationId === loc.id
    const stop = routeStops.indexOf(loc.id)
    const fill = fillForLayer(state, loc, layer)
    const pct = Math.min(1, occ / loc.capacity)
    const dark = st !== 'libre' && st !== 'bloqueada' && pct > 0.55
    const isRack = loc.kind === 'estanteria'
    const isDock = loc.kind === 'muelle'
    const h = isRack ? LEVEL_H : isDock ? 2 : 4 + (occ > 0 ? 6 + 30 * pct : 0)
    const faces = boxFaces(loc.x, loc.y, loc.w, loc.h, h)
    const palletFaces = !isRack && !isDock ? boxFaces(loc.x, loc.y, loc.w, loc.h, 4) : null
    const c = iso(loc.x + loc.w / 2, loc.y + loc.h / 2, h + 1)
    const stroke = isDock ? '#0f172a' : 'rgba(15,23,42,0.45)'
    push(loc.x + loc.w + loc.y + loc.h + 0.5, (
      <g key={loc.id} data-loc={loc.id} className={cx('map-location', isSel && 'selected', isSource && 'source', isDropTarget && (drag?.overReason ? 'drop-bad' : 'drop-ok'), stop >= 0 && 'highlight', dimmed && 'dimmed', recent.has(loc.id) && !isSel && 'recent')}
        onPointerDown={(e) => onLocationPointerDown(loc, e)} onPointerEnter={() => onHover(loc.id)} onPointerLeave={() => onHover(null)}
        tabIndex={0} role="button" aria-label={`${loc.code} ${t(LOCATION_STATUS[st].label)} ${occ}/${loc.capacity}`} onKeyDown={(e) => e.key === 'Enter' && onSelect(loc.id)}>
        <title>{loc.code} · {t(LOCATION_STATUS[st].label)} · {occ}/{loc.capacity} {t('uds')}</title>
        {palletFaces && <><polygon points={palletFaces.south} fill="#92400e" stroke={stroke} strokeWidth="0.5" /><polygon points={palletFaces.east} fill="#b45309" stroke={stroke} strokeWidth="0.5" /><polygon points={palletFaces.top} fill={occ > 0 ? '#d97706' : '#e2e8f0'} stroke={stroke} strokeWidth="0.5" /></>}
        {(isRack || isDock || occ > 0) && <>
          <polygon points={palletFaces ? boxFaces(loc.x + 3, loc.y + 3, loc.w - 6, loc.h - 6, h - 4, 4).south : faces.south} fill={st === 'bloqueada' ? '#f87171' : shade(fill, 0.62)} stroke={stroke} strokeWidth="0.6" />
          <polygon points={palletFaces ? boxFaces(loc.x + 3, loc.y + 3, loc.w - 6, loc.h - 6, h - 4, 4).east : faces.east} fill={st === 'bloqueada' ? '#fca5a5' : shade(fill, 0.8)} stroke={stroke} strokeWidth="0.6" />
          <polygon points={palletFaces ? boxFaces(loc.x + 3, loc.y + 3, loc.w - 6, loc.h - 6, h - 4, 4).top : faces.top} fill={fill} stroke={hoverId === loc.id ? '#1d6ff2' : stroke} strokeWidth="0.7" />
        </>}
        {isDock && <text x={c.X} y={c.Y + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#f8fafc" fontFamily={FONT} className="pointer-events-none">M{loc.module}</text>}
        {!isRack && !isDock && <text x={c.X} y={c.Y + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill={dark ? '#fff' : '#1e293b'} fontFamily={FONT} className="pointer-events-none">{loc.code.replace(/-00-/, '-').replace(/-01$/, '')}{occ > 0 ? ` · ${occ}` : ''}</text>}
        {showQty && isRack && occ > 0 && <text x={c.X} y={c.Y + 2} textAnchor="middle" fontSize="6" fontWeight="700" fill={dark ? '#fff' : '#0b1630'} fontFamily={FONT} className="pointer-events-none">{occ}</text>}
        {showCodes && isRack && <text x={c.X} y={c.Y - 6} textAnchor="middle" fontSize="3.6" fill={dark ? '#dbeafe' : '#475569'} fontFamily={FONT} className="pointer-events-none">{loc.code}</text>}
        {stop >= 0 && <g className="pointer-events-none"><circle cx={c.X} cy={c.Y - 10} r="9" fill="#f97316" stroke="#fff" strokeWidth="2" /><text x={c.X} y={c.Y - 6.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily={FONT}>{stop + 1}</text></g>}
      </g>
    ))
  }

  // Camiones, carretillas, oficina
  docksIn.forEach((d, i) => { if (i < Math.max(1, pendingIn)) push(d.x + d.y + 400, <Truck3D key={d.id} x={d.x + 30} y={d.y + 62} dir="in" color="#2563eb" delay={i * 0.7} />) })
  docksOut.forEach((d, i) => { if (i < pendingOut) push(d.x + d.y + 400, <Truck3D key={d.id} x={d.x + 40} y={d.y + 62} dir="out" color="#16a34a" delay={i * 0.9} />) })
  if (activePicks > 0) push(1185 + CORRIDOR_BOTTOM_Y + 40, <Forklift3D key="fk1" x={1174} y={CORRIDOR_BOTTOM_Y - 8} delay={0} />)
  if (pendingIn > 0) push(300 + 700 + 40, <Forklift3D key="fk2" x={300} y={700} delay={1.3} />)
  const ofi = zones.find((z) => z.type === 'oficinas')
  if (ofi) push(ofi.x + ofi.w + ofi.y + ofi.h, <g key="ofi"><Box x={ofi.x + 6} y={ofi.y + 6} w={ofi.w - 12} d={ofi.h - 12} h={34} color="#e2e8f0" topColor="#f1f5f9" />{[0, 1, 2, 3, 4].map((i) => <Box key={i} x={ofi.x + 30 + i * 90} y={ofi.y + ofi.h - 7} w={40} d={1} h={16} z0={10} color="#93c5fd" stroke="none" opacity={0.8} />)}<Label x={ofi.x + ofi.w / 2} y={ofi.y + ofi.h / 2} z={40} text={t('Oficinas y servicios').toUpperCase()} size={10} color="#475569" /></g>)

  // Paredes: norte y oeste altas; sur y este como zócalo con huecos en los muelles
  const walls: ReactNode[] = [
    <Box key="wn" x={20} y={6} w={MAP_W - 40} d={6} h={WALL_H} color="#cbd5e1" topColor="#e2e8f0" />,
    <Box key="ww" x={14} y={6} w={6} d={MAP_H - 110} h={WALL_H} color="#cbd5e1" topColor="#e2e8f0" />,
    <Box key="we" x={MAP_W - 20} y={6} w={6} d={MAP_H - 110} h={6} color="#cbd5e1" />,
  ]
  const dockXs = [...docksIn, ...docksOut].map((d) => [d.x + 6, d.x + d.w - 6] as const).sort((a, b) => a[0] - b[0])
  let cursor = 20
  for (const [a, b] of dockXs) { if (a > cursor) walls.push(<Box key={`ws${cursor}`} x={cursor} y={MAP_H - 110} w={a - cursor} d={6} h={6} color="#cbd5e1" />); walls.push(<Box key={`door${a}`} x={a} y={MAP_H - 112} w={b - a} d={3} h={30} color="#1e293b" topColor="#334155" opacity={0.9} />); cursor = b }
  walls.push(<Box key="wsend" x={cursor} y={MAP_H - 110} w={MAP_W - 20 - cursor} d={6} h={6} color="#cbd5e1" />)
  // Cámaras: cerramiento translúcido
  for (const z of zones.filter((zz) => zz.temperature && zz.temperature !== 'ambiente')) {
    const c = '#bfdbfe'
    push(z.x + z.y - 1, <Box key={z.id + 'n'} x={z.x} y={z.y} w={z.w} d={2} h={28} color={c} opacity={0.55} stroke="rgba(37,99,235,0.5)" />)
    push(z.x + z.y - 1, <Box key={z.id + 'w'} x={z.x} y={z.y} w={2} d={z.h} h={28} color={c} opacity={0.55} stroke="rgba(37,99,235,0.5)" />)
    push(z.x + z.w + z.y + z.h + 2, <Box key={z.id + 's'} x={z.x} y={z.y + z.h - 2} w={z.w} d={2} h={28} color={c} opacity={0.35} stroke="rgba(37,99,235,0.5)" />)
    push(z.x + z.w + z.y + z.h + 2, <Box key={z.id + 'e'} x={z.x + z.w - 2} y={z.y} w={2} d={z.h} h={28} color={c} opacity={0.35} stroke="rgba(37,99,235,0.5)" />)
  }
  // Pilares
  for (const px of [250, 450, 650, 850, 1050, 1250, 1450]) for (const py of [160, 660]) push(px + py + 10, <Box key={`col${px}-${py}`} x={px - 5} y={py - 5} w={10} d={10} h={WALL_H} color="#94a3b8" topColor="#cbd5e1" />)

  items.sort((a, b) => a.depth - b.depth)
  const routeD = route && route.length > 1 ? route.map((p, i) => { const q = iso(p.x, p.y, 3); return `${i === 0 ? 'M' : 'L'}${q.X} ${q.Y}` }).join(' ') : null
  const flowPts: [number, number][] = [[docksIn[0]?.x ?? 100, 900], [300, 760], [700, 760], [700, CORRIDOR_BOTTOM_Y], [870, CORRIDOR_BOTTOM_Y], [870, CORRIDOR_TOP_Y], [1180, CORRIDOR_TOP_Y], [1180, CORRIDOR_BOTTOM_Y], [1440, CORRIDOR_BOTTOM_Y], [1440, 760], [1230, 760], [1230, docksOut[1]?.y ?? 900]]
  const flowD = flowPts.map(([x, y], i) => { const q = iso(x, y, 2); return `${i === 0 ? 'M' : 'L'}${q.X} ${q.Y}` }).join(' ')
  const routeStart = route && route[0] ? iso(route[0].x, route[0].y, 3) : null

  return (
    <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="h-full w-full touch-none select-none" style={{ background: 'linear-gradient(180deg,#dfe5ee 0%,#eef1f6 60%,#e3e8f0 100%)' }} {...handlers} onPointerLeave={handlers.onPointerUp}
      onClick={(e) => { if ((e.target as SVGElement).tagName === 'svg' || (e.target as SVGElement).dataset.bg) onSelect(null) }} role="application" aria-label={t('Plano del almacén')}>
      <defs>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#fecaca" /><line x1="0" y1="0" x2="0" y2="8" stroke="#dc2626" strokeWidth="3" /></pattern>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316" /></marker>
        <marker id="arrow-flow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#2f7cff" /></marker>
        <marker id="arrow-aisle" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" /></marker>
        <linearGradient id="floor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f8fafc" /><stop offset="1" stopColor="#e9eef5" /></linearGradient>
      </defs>
      {/* Parcela, patio y suelo de la nave */}
      <polygon data-bg="1" points={floorPoly(-20, -20, MAP_W + 40, MAP_H + 40)} fill="#d4dbe6" />
      <polygon data-bg="1" points={floorPoly(20, MAP_H - 104, MAP_W - 40, 104)} fill="#b8c2d0" />
      {[0, 1, 2].map((i) => <polyline key={i} points={pts([iso(40, MAP_H - 84 + i * 32), iso(MAP_W - 20, MAP_H - 84 + i * 32)])} fill="none" stroke="#f8fafc" strokeWidth="1.5" strokeDasharray="16 12" className="pointer-events-none" />)}
      <polygon data-bg="1" points={floorPoly(20, 10, MAP_W - 40, MAP_H - 120)} fill="url(#floor)" stroke="#94a3b8" strokeWidth="1" />
      {/* Zonas (suelo) */}
      {zones.map((z) => { const zt = ZONE_TYPE[z.type]; const isDock = z.type.startsWith('muelles'); return <polygon key={z.id} data-bg="1" points={floorPoly(z.x, z.y, z.w, z.h)} fill={isDock ? '#64748b' : zt.fill} stroke={isDock ? '#1e293b' : zt.color} strokeWidth="1.2" strokeDasharray={z.type === 'oficinas' ? '6 4' : undefined} opacity={0.95} /> })}
      {/* Corredores y pasillos */}
      {[CORRIDOR_TOP_Y - 14, CORRIDOR_BOTTOM_Y].map((y) => <g key={y} className="pointer-events-none"><polygon points={floorPoly(40, y, 1020, 14)} fill="#fff" opacity="0.8" /><polyline points={pts([iso(48, y + 7), iso(1052, y + 7)])} fill="none" stroke="#facc15" strokeWidth="1.5" strokeDasharray="14 10" /></g>)}
      {Array.from({ length: AISLES }, (_, i) => i + 1).map((a) => {
        const g = aisleGeometry(a); const dir = a % 2 === 1 ? 1 : -1
        const y1 = dir === 1 ? g.bottom - 24 : g.top + 24, y2 = dir === 1 ? g.top + 24 : g.bottom - 24
        return <g key={a} className="pointer-events-none">
          <polygon points={floorPoly(g.cx - 24, g.top, 48, g.bottom - g.top)} fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.8" />
          <polyline points={pts([iso(g.cx - 21, g.top + 4), iso(g.cx - 21, g.bottom - 4)])} fill="none" stroke="#facc15" strokeWidth="1" /><polyline points={pts([iso(g.cx + 21, g.top + 4), iso(g.cx + 21, g.bottom - 4)])} fill="none" stroke="#facc15" strokeWidth="1" />
          <polyline points={pts([iso(g.cx, y1), iso(g.cx, y2)])} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="6 6" markerEnd="url(#arrow-aisle)" />
        </g>
      })}
      {/* Capa de flujo */}
      {showFlow && <g className="pointer-events-none"><path d={flowD} fill="none" stroke="#2f7cff" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" opacity="0.18" /><path d={flowD} fill="none" stroke="#2f7cff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" className="flow-path" markerEnd="url(#arrow-flow)" /></g>}
      {/* Paredes traseras antes de los objetos */}
      {walls.slice(0, 2)}
      {/* Objetos ordenados de atrás hacia delante */}
      {items.map((it) => it.node)}
      {walls.slice(2)}
      {/* Ruta sobre el suelo */}
      {routeD && <g className="pointer-events-none"><path d={routeD} fill="none" stroke="#f97316" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" opacity="0.2" /><path d={routeD} fill="none" stroke="#f97316" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="route-path" markerEnd="url(#arrow)" />{routeStart && <circle cx={routeStart.X} cy={routeStart.Y} r="7" fill="#f97316" stroke="#fff" strokeWidth="2" />}</g>}
      {/* Rótulos */}
      {zones.map((z) => { const zt = ZONE_TYPE[z.type]; const isDock = z.type.startsWith('muelles'); const text = z.w < 300 ? `${t('Zona')} ${z.code}` : t(z.name); const temp = z.temperature && z.temperature !== 'ambiente' ? ` · ❄ ${z.temperature === 'congelado' ? '-18 °C' : z.temperature === 'refrigerado' ? '0-4 °C' : '8-13 °C'}` : ''; return <Label key={z.id + 'l'} x={z.x + 12} y={z.y + 12} z={z.type === 'oficinas' ? 50 : 30} text={(text + temp).toUpperCase()} size={9} color={isDock ? '#f8fafc' : zt.color} anchor="start" bg={isDock ? undefined : '#ffffff'} /> })}
      {Array.from({ length: AISLES }, (_, i) => i + 1).map((a) => { const g = aisleGeometry(a); return <Label key={'pl' + a} x={g.cx} y={g.top - 14} z={24} text={`P${String(a).padStart(2, '0')}`} size={11} color="#ffffff" bg="#1e3a8a" /> })}
      {showFlow && [['1', 150, 745, t('Recepción')], ['2', 690, 745, t('Calidad')], ['3', 870, 400, t('Almacenamiento')], ['4', 1180, 400, t('Picking')], ['5', 1440, 400, t('Consolidación')], ['6', 1230, 745, t('Expedición')]].map(([n, x, y, label]) => { const p = iso(Number(x), Number(y), 20); return <g key={String(n)} className="pointer-events-none"><circle cx={p.X} cy={p.Y} r="14" fill="#1d6ff2" stroke="#fff" strokeWidth="3" /><text x={p.X} y={p.Y + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily={FONT}>{n}</text><text x={p.X} y={p.Y + 30} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1d6ff2" fontFamily={FONT}>{label}</text></g> })}
      <Label x={MAP_W / 2} y={MAP_H - 6} text={t('PATIO DE MANIOBRAS · FRENTE DE MUELLES')} size={10} color="#475569" />
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
      {/* Norte */}
      <g className="pointer-events-none" transform={`translate(${vb.x + vb.w - 60} ${vb.y + 40})`}><circle r="12" fill="#fff" stroke="#334155" strokeWidth="1.5" /><path d="M0 -8 L4 6 L0 3 L-4 6 Z" fill="#1e3a8a" /><text y="26" textAnchor="middle" fontSize="9" fontWeight="700" fill="#334155" fontFamily={FONT}>N</text></g>
      {/* Conteo rápido de ubicaciones con stock oculto en vista lejana */}
      {zoom < 0.9 && <text x={vb.x + vb.w / 2} y={vb.y + vb.h - 10} textAnchor="middle" fontSize="12" fill="#64748b" fontFamily={FONT}>{t('Acerca el plano para ver cantidades y códigos')} · {locations.filter((l) => stockEntriesAt(state, l.id).length > 0).length} {t('ubicaciones con stock')}</text>}
    </svg>
  )
})
