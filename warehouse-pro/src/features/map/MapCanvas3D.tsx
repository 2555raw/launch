import { memo, type PointerEvent as RPointerEvent, type RefObject, type ReactNode } from 'react'
import { AISLES, CORRIDOR_BOTTOM_Y, CORRIDOR_TOP_Y, MAP_H, MAP_W, aisleGeometry, locationStatus, occupiedAt, stockEntriesAt, type Location, type RoutePoint, type WarehouseState, values } from '@/domain'
import { LOCATION_STATUS, ZONE_TYPE } from '@/lib/labels'
import { t } from '@/lib/i18n'
import { cx } from '@/lib/format'
import type { ViewBox } from './useViewBox'
import { fillForLayer, type MapLayer } from './layers'
import { boxFaces, depthOf, floorPoly, isBackWall, iso, pts, setAngle, shade } from './projection'

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
  angle?: number
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  onLocationPointerDown: (loc: Location, e: RPointerEvent<SVGElement>) => void
  handlers: { onWheel: (e: React.WheelEvent<SVGSVGElement>) => void; onPointerDown: (e: RPointerEvent<SVGSVGElement>) => void; onPointerMove: (e: RPointerEvent<SVGSVGElement>) => void; onPointerUp: (e: RPointerEvent<SVGSVGElement>) => void }
}

const FONT = 'Inter, system-ui'
const CX0 = MAP_W / 2, CY0 = MAP_H / 2
const LEVEL_H = 11
const WALL_H = 46

interface Item { depth: number; node: ReactNode }

/** Caja volumétrica decorativa (sin eventos de puntero). */
function Box({ x, y, w, d, h, z0 = 0, color, stroke = 'rgba(15,23,42,0.35)', opacity = 1, topColor }: { x: number; y: number; w: number; d: number; h: number; z0?: number; color: string; stroke?: string; opacity?: number; topColor?: string }) {
  const f = boxFaces(x, y, w, d, h, z0)
  return (
    <g className="pointer-events-none" opacity={opacity}>
      {f.sides.map((side, i) => <polygon key={i} points={side.points} fill={shade(color, side.f)} stroke={stroke} strokeWidth="0.6" />)}
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
  // Camión aparcado marcha atrás contra el muelle: caja (norte) + cabina (sur). Footprint 36 × 96.
  const W = 36, TL = 62, CAB = 24
  const cabY = y + TL + 3
  return (
    <g className="pointer-events-none" style={{ animation: `truck 6s ease-in-out ${delay}s infinite` }}>
      <polygon points={floorPoly(x - 5, y - 2, W + 12, TL + CAB + 10)} fill="rgba(15,23,42,0.22)" />
      {/* Ruedas */}
      {[y + 6, y + 14, y + TL - 10, cabY + 12].map((wy, i) => <g key={i}><Box x={x - 1} y={wy} w={4} d={7} h={7} color="#0f172a" stroke="none" /><Box x={x + W - 3} y={wy} w={4} d={7} h={7} color="#0f172a" stroke="none" /></g>)}
      {/* Chasis */}
      <Box x={x + 2} y={y + 2} w={W - 4} d={TL + CAB + 2} h={3} z0={5} color="#334155" stroke="none" />
      {/* Caja del tráiler */}
      <Box x={x} y={y} w={W} d={TL} h={34} z0={8} color="#e2e8f0" topColor="#f8fafc" stroke="rgba(15,23,42,0.4)" />
      {/* Franja corporativa en los laterales visibles (este y sur de la caja) */}
      <Box x={x + W - 0.6} y={y + 4} w={0.6} d={TL - 8} h={8} z0={20} color={color} stroke="none" />
      <Box x={x + 4} y={y + TL - 0.6} w={W - 8} d={0.6} h={8} z0={20} color={color} stroke="none" />
      {/* Puertas traseras (lado del muelle): junta vertical */}
      <Box x={x + W / 2 - 0.4} y={y - 0.6} w={0.8} d={0.6} h={30} z0={9} color="#94a3b8" stroke="none" />
      {/* Cabina */}
      <Box x={x + 1} y={cabY} w={W - 2} d={CAB} h={22} z0={8} color={color} topColor={shade(color, 1.15)} />
      <Box x={x + 3} y={cabY + CAB - 1} w={W - 6} d={1} h={10} z0={18} color="#bfdbfe" stroke="none" />
      <Box x={x + 1} y={cabY + CAB} w={W - 2} d={3} h={6} z0={8} color="#1e293b" stroke="none" />
      {/* Faros y luces de posición */}
      <Box x={x + 3} y={cabY + CAB + 2.6} w={5} d={1} h={2} z0={11} color="#fef08a" stroke="none" />
      <Box x={x + W - 8} y={cabY + CAB + 2.6} w={5} d={1} h={2} z0={11} color="#fef08a" stroke="none" />
      <Box x={x + 1} y={y + 0.5} w={3} d={1} h={2} z0={38} color="#fb7185" stroke="none" />
      <Box x={x + W - 4} y={y + 0.5} w={3} d={1} h={2} z0={38} color="#fb7185" stroke="none" />
      {/* Marca en el techo del tráiler */}
      <Label x={x + W / 2} y={y + TL / 2} z={43} text="BETO" size={8} color={color} />
      <Label x={x + W + 14} y={cabY + CAB / 2} z={2} text={dir === 'in' ? '▲ ' + t('ENTRADA') : '▼ ' + t('SALIDA')} size={7} color={color} bg="#ffffff" />
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

export const MapCanvas3D = memo(function MapCanvas3D({ state, vb, svgRef, selectedId, hoverId, matches, route, routeStops, drag, showFlow, layer, recent, angle = 0, onSelect, onHover, onLocationPointerDown, handlers }: CanvasProps) {
  setAngle(angle)
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
    push(depthOf(x, y, w, d) - 200, <polygon key={k + 'f'} points={floorPoly(x - 2, y - 2, w + 4, d + 4)} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" className="pointer-events-none" />)
    for (const [ux, uy] of [[x - 2, y - 2], [x + w, y - 2], [x - 2, y + d], [x + w, y + d]]) push(depthOf(ux, uy, 2, 2) + 0.5, <Box key={`${k}-${ux}-${uy}`} x={ux} y={uy} w={2} d={2} h={LEVEL_H + 9} color="#f97316" stroke="none" />)
    // Larguero superior trasero
    push(depthOf(x - 2, y - 2, w + 4, 1.2), <Box key={k + 'b'} x={x - 2} y={y - 2} w={w + 4} d={1.2} h={1.5} z0={LEVEL_H + 8} color="#fb923c" stroke="none" />)
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
    const inner = palletFaces ? boxFaces(loc.x + 3, loc.y + 3, loc.w - 6, loc.h - 6, h - 4, 4) : faces
    push(depthOf(loc.x, loc.y, loc.w, loc.h) + 0.5, (
      <g key={loc.id} data-loc={loc.id} className={cx('map-location', isSel && 'selected', isSource && 'source', isDropTarget && (drag?.overReason ? 'drop-bad' : 'drop-ok'), stop >= 0 && 'highlight', dimmed && 'dimmed', recent.has(loc.id) && !isSel && 'recent')}
        onPointerDown={(e) => onLocationPointerDown(loc, e)} onPointerEnter={() => onHover(loc.id)} onPointerLeave={() => onHover(null)}
        tabIndex={0} role="button" aria-label={`${loc.code} ${t(LOCATION_STATUS[st].label)} ${occ}/${loc.capacity}`} onKeyDown={(e) => e.key === 'Enter' && onSelect(loc.id)}>
        <title>{loc.code} · {t(LOCATION_STATUS[st].label)} · {occ}/{loc.capacity} {t('uds')}</title>
        {palletFaces && <>{palletFaces.sides.map((sd, i) => <polygon key={i} points={sd.points} fill={shade('#b45309', sd.f)} stroke={stroke} strokeWidth="0.5" />)}<polygon points={palletFaces.top} fill={occ > 0 ? '#d97706' : '#e2e8f0'} stroke={stroke} strokeWidth="0.5" /></>}
        {(isRack || isDock || occ > 0) && <>
          {inner.sides.map((sd, i) => <polygon key={i} points={sd.points} fill={st === 'bloqueada' ? (sd.f > 0.7 ? '#fca5a5' : '#f87171') : shade(fill, sd.f)} stroke={stroke} strokeWidth="0.6" />)}
          <polygon points={inner.top} fill={fill} stroke={hoverId === loc.id ? '#1d6ff2' : stroke} strokeWidth="0.7" />
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
  docksIn.forEach((d, i) => { if (i < Math.max(1, pendingIn)) push(depthOf(d.x, d.y - 4, d.w, 100), <Truck3D key={`truck-${d.id}`} x={d.x + (d.w - 36) / 2} y={d.y - 4} dir="in" color="#2563eb" delay={i * 0.7} />) })
  docksOut.forEach((d, i) => { if (i < pendingOut) push(depthOf(d.x, d.y - 4, d.w, 100), <Truck3D key={`truck-${d.id}`} x={d.x + (d.w - 36) / 2} y={d.y - 4} dir="out" color="#16a34a" delay={i * 0.9} />) })
  if (activePicks > 0) push(depthOf(1174, CORRIDOR_BOTTOM_Y - 8, 36, 24), <Forklift3D key="fk1" x={1174} y={CORRIDOR_BOTTOM_Y - 8} delay={0} />)
  if (pendingIn > 0) push(depthOf(300, 700, 36, 24), <Forklift3D key="fk2" x={300} y={700} delay={1.3} />)
  const ofi = zones.find((z) => z.type === 'oficinas')
  if (ofi) push(depthOf(ofi.x, ofi.y, ofi.w, ofi.h), <g key="ofi"><Box x={ofi.x + 6} y={ofi.y + 6} w={ofi.w - 12} d={ofi.h - 12} h={34} color="#e2e8f0" topColor="#f1f5f9" />{[0, 1, 2, 3, 4].map((i) => <Box key={i} x={ofi.x + 30 + i * 90} y={ofi.y + ofi.h - 7} w={40} d={1} h={16} z0={10} color="#93c5fd" stroke="none" opacity={0.8} />)}<Label x={ofi.x + ofi.w / 2} y={ofi.y + ofi.h / 2} z={40} text={t('Oficinas y servicios').toUpperCase()} size={10} color="#475569" /></g>)

  // Paredes: norte y oeste altas; sur y este como zócalo con huecos en los muelles
  const hN = isBackWall(0, -1) ? WALL_H : 6, hW = isBackWall(-1, 0) ? WALL_H : 6, hE = isBackWall(1, 0) ? WALL_H : 6, hS = isBackWall(0, 1) ? WALL_H : 6
  const wallItems: { depth: number; node: ReactNode }[] = [
    { depth: depthOf(20, 6, MAP_W - 40, 6), node: <Box key="wn" x={20} y={6} w={MAP_W - 40} d={6} h={hN} color="#cbd5e1" topColor="#e2e8f0" /> },
    { depth: depthOf(14, 6, 6, MAP_H - 110), node: <Box key="ww" x={14} y={6} w={6} d={MAP_H - 110} h={hW} color="#cbd5e1" topColor="#e2e8f0" /> },
    { depth: depthOf(MAP_W - 20, 6, 6, MAP_H - 110), node: <Box key="we" x={MAP_W - 20} y={6} w={6} d={MAP_H - 110} h={hE} color="#cbd5e1" topColor="#e2e8f0" /> },
  ]
  const dockXs = [...docksIn, ...docksOut].map((d) => [d.x + 6, d.x + d.w - 6] as const).sort((a, b) => a[0] - b[0])
  let cursor = 20
  for (const [a, b] of dockXs) { if (a > cursor) wallItems.push({ depth: depthOf(cursor, MAP_H - 110, a - cursor, 6), node: <Box key={`ws${cursor}`} x={cursor} y={MAP_H - 110} w={a - cursor} d={6} h={hS} color="#cbd5e1" topColor="#e2e8f0" /> }); wallItems.push({ depth: depthOf(a, MAP_H - 112, b - a, 3) + 0.1, node: <Box key={`door${a}`} x={a} y={MAP_H - 112} w={b - a} d={3} h={Math.max(30, hS * 0.7)} color="#1e293b" topColor="#334155" opacity={0.9} /> }); cursor = b }
  wallItems.push({ depth: depthOf(cursor, MAP_H - 110, MAP_W - 20 - cursor, 6), node: <Box key="wsend" x={cursor} y={MAP_H - 110} w={MAP_W - 20 - cursor} d={6} h={hS} color="#cbd5e1" topColor="#e2e8f0" /> })
  // Las paredes de fondo se pintan antes que todo; las frontales (bajas) después
  for (const wI of wallItems) items.push({ depth: wI.depth > depthOf(CX0, CY0, 0, 0) ? wI.depth + 5000 : -5000 + wI.depth, node: wI.node })
  // Cámaras: cerramiento translúcido
  for (const z of zones.filter((zz) => zz.temperature && zz.temperature !== 'ambiente')) {
    const c = '#bfdbfe'
    const segs: [string, number, number, number, number, number, number][] = [[z.id + 'n', z.x, z.y, z.w, 2, 0, -1], [z.id + 'w', z.x, z.y, 2, z.h, -1, 0], [z.id + 's', z.x, z.y + z.h - 2, z.w, 2, 0, 1], [z.id + 'e', z.x + z.w - 2, z.y, 2, z.h, 1, 0]]
    for (const [key, sx, sy, sw, sd, nx, ny] of segs) { const back = isBackWall(nx, ny); push(back ? depthOf(sx, sy, sw, sd) - 400 : depthOf(sx, sy, sw, sd) + 1, <Box key={key} x={sx} y={sy} w={sw} d={sd} h={28} color={c} opacity={back ? 0.55 : 0.35} stroke="rgba(37,99,235,0.5)" />) }
  }
  // Pilares
  for (const px of [250, 450, 650, 850, 1050, 1250, 1450]) for (const py of [160, 660]) push(depthOf(px - 5, py - 5, 10, 10), <Box key={`col${px}-${py}`} x={px - 5} y={py - 5} w={10} d={10} h={WALL_H} color="#94a3b8" topColor="#cbd5e1" />)

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
      {/* Objetos ordenados de atrás hacia delante (paredes de fondo primero, frontales al final) */}
      {items.map((it) => it.node)}
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
      <g className="pointer-events-none" transform={`translate(${vb.x + vb.w - 60} ${vb.y + 40})`}><circle r="12" fill="#fff" stroke="#334155" strokeWidth="1.5" /><path d="M0 -8 L4 6 L0 3 L-4 6 Z" fill="#1e3a8a" transform={`rotate(${angle})`} /><text y="26" textAnchor="middle" fontSize="9" fontWeight="700" fill="#334155" fontFamily={FONT}>N</text></g>
      {/* Conteo rápido de ubicaciones con stock oculto en vista lejana */}
      {zoom < 0.9 && <text x={vb.x + vb.w / 2} y={vb.y + vb.h - 10} textAnchor="middle" fontSize="12" fill="#64748b" fontFamily={FONT}>{t('Acerca el plano para ver cantidades y códigos')} · {locations.filter((l) => stockEntriesAt(state, l.id).length > 0).length} {t('ubicaciones con stock')}</text>}
    </svg>
  )
})
