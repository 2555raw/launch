import { Box, Crosshair, Filter, GitBranch, Layers, Minus, Move, Plus, Route, RotateCcw, RotateCw, Search, Square, Waves, X, Orbit } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Badge, Button, Modal, Select, Tooltip } from '@/components/ui'
import { availableAt, buildRoute, checkCanReceive, locationStatus, pickingSortKey, routeBetween, routeLength, stockEntriesAt, stockEntriesOf, values, type Location, type RoutePoint } from '@/domain'
import { useRole, useState$ } from '@/store/useWarehouse'
import { LOCATION_STATUS, TEMPERATURE, ZONE_TYPE } from '@/lib/labels'
import { t } from '@/lib/i18n'
import { cx, fmtInt } from '@/lib/format'
import { navigate } from '@/lib/router'
import { MapCanvas } from './MapCanvas'
import { MapCanvas3D, type DragState } from './MapCanvas3D'
import { LAYERS, legendForLayer, recentlyChanged, type MapLayer } from './layers'
import { BOUNDS, centerOf, floorPoly, setAngle, type MapMode } from './projection'
import { LocationPanel } from './LocationPanel'
import { MoveDialog, type MoveRequest } from './MoveDialog'
import { FlowsPanel } from './FlowsPanel'
import { TransferForm } from '../transfers/TransferForm'
import { useViewBox } from './useViewBox'

export function WarehouseMap({ params }: { params: Record<string, string> }) {
  const state = useState$()
  const { can } = useRole()
  const svgRef = useRef<SVGSVGElement>(null)
  const [mode, setMode] = useState<MapMode>(() => { try { return (localStorage.getItem('warehouse-pro:map-mode') as MapMode) || '3d' } catch { return '3d' } })
  const [layer, setLayer] = useState<MapLayer>('ocupacion')
  const [angle, setAngleState] = useState(0)
  const [autoRotate, setAutoRotate] = useState(false)
  const angleRef = useRef(0)
  const animRef = useRef<number | null>(null)
  setAngle(angle)
  /** Gira el almacén con animación suave hasta el ángulo destino. */
  const rotateTo = useCallback((target: number) => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    const from = angleRef.current, delta = target - from, t0 = performance.now(), dur = 450
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3)
      const a = from + delta * e
      angleRef.current = a
      setAngleState(a)
      if (k < 1) animRef.current = requestAnimationFrame(step)
    }
    animRef.current = requestAnimationFrame(step)
  }, [])
  const rotateBy = useCallback((deg: number) => { setAutoRotate(false); rotateTo(angleRef.current + deg) }, [rotateTo])
  useEffect(() => {
    if (!autoRotate) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => { const dt = now - last; last = now; angleRef.current = (angleRef.current + dt * 0.02) % 360; setAngleState(angleRef.current); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [autoRotate])
  const bounds = BOUNDS[mode]
  const view = useViewBox(svgRef, bounds)
  const [tick, setTick] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(params.loc ?? null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [query, setQuery] = useState(params.sku ? state.products[params.sku]?.sku ?? '' : '')
  const [zoneFilter, setZoneFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tempFilter, setTempFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showFlow, setShowFlow] = useState(false)
  const [flowsOpen, setFlowsOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [routeFromId, setRouteFromId] = useState<string | null>(null)
  const [manualRoute, setManualRoute] = useState<{ pts: RoutePoint[]; stops: string[]; label: string } | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [moveReq, setMoveReq] = useState<MoveRequest | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  const pressRef = useRef<{ loc: Location; x: number; y: number; moved: boolean } | null>(null)

  const locations = useMemo(() => values(state.locations), [state])
  const recent = useMemo(() => recentlyChanged(state), [state, tick])
  useEffect(() => { if (recent.size === 0) return; const id = setTimeout(() => setTick((v) => v + 1), 21000); return () => clearTimeout(id) }, [recent])
  useEffect(() => { try { localStorage.setItem('warehouse-pro:map-mode', mode) } catch { /* ignore */ } }, [mode])
  const focusLoc = useCallback((l: Location, w = 360) => { const c = centerOf(mode, l); view.focusOn(c.X, c.Y, mode === '3d' ? w * 1.4 : w) }, [mode, view])
  // Teclado: flechas desplazan, +/- zoom, Esc deselecciona
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === 'ArrowLeft') { view.panBy(-0.08, 0); e.preventDefault() }
      else if (e.key === 'ArrowRight') { view.panBy(0.08, 0); e.preventDefault() }
      else if (e.key === 'ArrowUp') { view.panBy(0, -0.08); e.preventDefault() }
      else if (e.key === 'ArrowDown') { view.panBy(0, 0.08); e.preventDefault() }
      else if (e.key === '+' || e.key === '=') view.zoomAt(0.8)
      else if (e.key === '-') view.zoomAt(1.25)
      else if (e.key === 'Escape') { setSelectedId(null); setRouteFromId(null); setManualRoute(null) }
      else if (e.key.toLowerCase() === 'v') setMode((m) => (m === '3d' ? '2d' : '3d'))
      else if (e.key.toLowerCase() === 'q') rotateBy(-45)
      else if (e.key.toLowerCase() === 'e') rotateBy(45)
      else if (e.key.toLowerCase() === 'r') setAutoRotate((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, rotateBy])
  const categories = useMemo(() => [...new Set(values(state.products).map((p) => p.category))].sort(), [state])

  // Producto buscado
  const matchedProduct = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return values(state.products).find((p) => p.sku.toLowerCase() === q || p.barcode === q) ?? values(state.products).find((p) => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) ?? null
  }, [query, state])
  const matchedLocation = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q || matchedProduct) return null
    return locations.find((l) => l.code === q) ?? locations.find((l) => l.code.includes(q)) ?? null
  }, [query, locations, matchedProduct])

  // Conjunto de ubicaciones que cumplen filtros / búsqueda (el resto se atenúa)
  const matches = useMemo(() => {
    const anyFilter = matchedProduct || matchedLocation || zoneFilter || statusFilter || tempFilter || catFilter
    if (!anyFilter) return null
    const set = new Set<string>()
    const productLocs = matchedProduct ? new Set(stockEntriesOf(state, matchedProduct.id).map((e) => e.locationId)) : null
    for (const l of locations) {
      if (productLocs && !productLocs.has(l.id)) continue
      if (matchedLocation && l.id !== matchedLocation.id) continue
      if (zoneFilter && l.zoneId !== zoneFilter) continue
      if (statusFilter && locationStatus(state, l) !== statusFilter) continue
      const zt = state.zones[l.zoneId]?.temperature ?? 'ambiente'
      if (tempFilter && zt !== tempFilter) continue
      if (catFilter && !stockEntriesAt(state, l.id).some((e) => state.products[e.productId]?.category === catFilter)) continue
      set.add(l.id)
    }
    return set
  }, [state, locations, matchedProduct, matchedLocation, zoneFilter, statusFilter, tempFilter, catFilter])

  // Ruta de picking de un pedido (desde la pantalla de pedidos)
  const orderRoute = useMemo(() => {
    const o = params.ruta ? state.orders[params.ruta] : null
    if (!o) return null
    const stops = [...new Set(o.lines.flatMap((l) => l.reservations.filter((r) => r.quantity > r.picked).map((r) => r.locationId)))]
      .map((id) => state.locations[id]).filter(Boolean).sort((a, b) => pickingSortKey(a) - pickingSortKey(b))
    return { pts: buildRoute(stops), stops: stops.map((s) => s.id), label: `${t('Ruta de picking')} ${o.number} · ${o.customer}` }
  }, [params.ruta, state])
  const activeRoute = manualRoute ?? orderRoute

  useEffect(() => {
    if (params.loc && state.locations[params.loc]) {
      const l = state.locations[params.loc]
      setSelectedId(l.id)
      focusLoc(l)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.loc])

  useEffect(() => {
    if (matchedProduct) {
      const locs = stockEntriesOf(state, matchedProduct.id).map((e) => state.locations[e.locationId]).filter(Boolean)
      if (locs.length) {
        const ps = locs.map((l) => centerOf(mode, l))
        const xs = ps.map((p) => p.X), ys = ps.map((p) => p.Y)
        const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
        view.focusOn((minX + maxX) / 2, (minY + maxY) / 2, Math.max(mode === '3d' ? 600 : 420, (maxX - minX) * 1.6 + 200))
      }
    } else if (matchedLocation) {
      setSelectedId(matchedLocation.id)
      focusLoc(matchedLocation)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedProduct?.id, matchedLocation?.id])

  // ---------- Arrastrar y soltar ----------
  const updateDragPosition = useCallback((clientX: number, clientY: number) => {
    const d = dragRef.current
    if (!d) return
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
    const locEl = el?.closest?.('[data-loc]') as HTMLElement | null
    const overId = locEl?.dataset.loc ?? null
    let reason: string | null = null
    if (overId && overId !== d.fromLocationId) reason = checkCanReceive(state, overId, d.productId, Math.min(d.maxQty, 1))
    else if (overId === d.fromLocationId) reason = t('Es la ubicación de origen')
    const p = view.clientToMap(clientX, clientY)
    const next = { ...d, overId, overReason: reason, x: p.x, y: p.y }
    dragRef.current = next
    setDrag(next)
  }, [state, view])

  const startDrag = useCallback((productId: string, fromLocationId: string, maxQty: number, clientX: number, clientY: number) => {
    const p = view.clientToMap(clientX, clientY)
    const d: DragState = { productId, fromLocationId, maxQty, overId: null, overReason: null, x: p.x, y: p.y }
    dragRef.current = d
    setDrag(d)
    const onMove = (e: PointerEvent) => updateDragPosition(e.clientX, e.clientY)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const cur = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (cur?.overId && !cur.overReason && cur.overId !== cur.fromLocationId) {
        setMoveReq({ productId: cur.productId, fromLocationId: cur.fromLocationId, toLocationId: cur.overId, maxQty: cur.maxQty })
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [view, updateDragPosition])

  const onPanelDrag = useCallback((productId: string, fromLocationId: string, maxQty: number, e: RPointerEvent<HTMLElement>) => {
    e.preventDefault()
    startDrag(productId, fromLocationId, maxQty, e.clientX, e.clientY)
  }, [startDrag])

  // Pulsar sobre una ubicación: clic = seleccionar; arrastrar (si tiene stock disponible) = mover su mercancía
  const onLocationPointerDown = useCallback((loc: Location, e: RPointerEvent<SVGElement>) => {
    e.stopPropagation()
    const entries = stockEntriesAt(state, loc.id).filter((en) => en.state === 'disponible')
    pressRef.current = { loc, x: e.clientX, y: e.clientY, moved: false }
    const onMove = (ev: PointerEvent) => {
      const pr = pressRef.current
      if (!pr || pr.moved) return
      if (Math.hypot(ev.clientX - pr.x, ev.clientY - pr.y) > 6) {
        pr.moved = true
        cleanup()
        if (entries.length > 0 && can('transfers')) {
          const first = entries[0]
          const movable = availableAt(state, loc.id, first.productId)
          if (movable > 0) startDrag(first.productId, loc.id, movable, ev.clientX, ev.clientY)
        }
      }
    }
    const onUp = () => {
      const pr = pressRef.current
      cleanup()
      if (pr && !pr.moved) {
        if (routeFromId && routeFromId !== loc.id) {
          const from = state.locations[routeFromId]
          const pts = routeBetween(from, loc)
          setManualRoute({ pts, stops: [from.id, loc.id], label: `${from.code} → ${loc.code} · ${routeLength(pts)} m` })
          setRouteFromId(null)
        }
        setSelectedId(loc.id)
      }
      pressRef.current = null
    }
    const cleanup = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [state, startDrag, routeFromId, can])

  const selected = selectedId ? state.locations[selectedId] : null
  const clearFilters = () => { setZoneFilter(''); setStatusFilter(''); setTempFilter(''); setCatFilter(''); setQuery('') }
  const activeFilters = [zoneFilter, statusFilter, tempFilter, catFilter].filter(Boolean).length
  const productLocs = matchedProduct ? stockEntriesOf(state, matchedProduct.id) : []

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[560px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Localizar SKU, nombre o ubicación (A-01-02-01)…')} className="input pl-8 pr-8" aria-label={t('Buscar en el plano')} />
          {query && <button onClick={() => setQuery('')} className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-700" aria-label={t('Limpiar')}><X className="h-4 w-4" /></button>}
        </div>
        <Button variant={filtersOpen || activeFilters ? 'secondary' : 'outline'} size="md" icon={<Filter className="h-4 w-4" />} onClick={() => setFiltersOpen((v) => !v)}>{t('Filtros')}{activeFilters ? ` (${activeFilters})` : ''}</Button>
        <Button variant={showFlow ? 'secondary' : 'outline'} icon={<Waves className="h-4 w-4" />} onClick={() => setShowFlow((v) => !v)}>{t('Flujo en U')}</Button>
        <Button variant="outline" icon={<GitBranch className="h-4 w-4" />} onClick={() => setFlowsOpen(true)}>{t('Comparar flujos')}</Button>
        {can('transfers') && <Button variant="primary" icon={<Move className="h-4 w-4" />} onClick={() => setFormOpen(true)}>{t('Mover por formulario')}</Button>}
        <Select value={layer} onChange={(e) => setLayer(e.target.value as MapLayer)} className="w-auto" aria-label={t('Capa de color')}>{LAYERS.map((l) => <option key={l.id} value={l.id}>{t('Capa')}: {t(l.label)}</option>)}</Select>
        <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
          <Tooltip text={t('Vista en planta (2D)')}><Button size="sm" variant={mode === '2d' ? 'secondary' : 'ghost'} icon={<Square className="h-4 w-4" />} onClick={() => setMode('2d')} aria-label="2D">2D</Button></Tooltip>
          <Tooltip text={t('Vista isométrica (3D)')}><Button size="sm" variant={mode === '3d' ? 'secondary' : 'ghost'} icon={<Box className="h-4 w-4" />} onClick={() => setMode('3d')} aria-label="3D">3D</Button></Tooltip>
        </div>
        {mode === '3d' && (
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <Tooltip text={t('Girar a la izquierda (Q)')}><Button size="sm" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => rotateBy(-45)} aria-label={t('Girar a la izquierda (Q)')} /></Tooltip>
            <span className="w-10 text-center font-mono text-xs text-slate-500">{Math.round(((angle % 360) + 360) % 360)}°</span>
            <Tooltip text={t('Girar a la derecha (E)')}><Button size="sm" variant="ghost" icon={<RotateCw className="h-4 w-4" />} onClick={() => rotateBy(45)} aria-label={t('Girar a la derecha (E)')} /></Tooltip>
            <Tooltip text={t('Giro automático 360° (R)')}><Button size="sm" variant={autoRotate ? 'secondary' : 'ghost'} icon={<Orbit className="h-4 w-4" />} onClick={() => setAutoRotate((v) => !v)} aria-label={t('Giro automático 360° (R)')} /></Tooltip>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <Tooltip text={t('Acercar')}><Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => view.zoomAt(0.8)} aria-label={t('Acercar')} /></Tooltip>
          <Tooltip text={t('Alejar')}><Button size="sm" variant="ghost" icon={<Minus className="h-4 w-4" />} onClick={() => view.zoomAt(1.25)} aria-label={t('Alejar')} /></Tooltip>
          <Tooltip text={t('Centrar plano')}><Button size="sm" variant="ghost" icon={<Crosshair className="h-4 w-4" />} onClick={view.reset} aria-label={t('Centrar plano')} /></Tooltip>
        </div>
      </div>

      {filtersOpen && (
        <div className="card grid animate-slide-up grid-cols-2 gap-2 p-3 md:grid-cols-5">
          <Select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} aria-label={t('Zona')}><option value="">{t('Todas las zonas')}</option>{values(state.zones).map((z) => <option key={z.id} value={z.id}>{t(z.name)}</option>)}</Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label={t('Estado')}><option value="">{t('Todos los estados')}</option>{Object.entries(LOCATION_STATUS).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}</Select>
          <Select value={tempFilter} onChange={(e) => setTempFilter(e.target.value)} aria-label={t('Temperatura')}><option value="">{t('Todas las temperaturas')}</option>{Object.entries(TEMPERATURE).map(([k, v]) => <option key={k} value={k}>{t(v.label)}</option>)}</Select>
          <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label={t('Tipo de mercancía')}><option value="">{t('Toda la mercancía')}</option>{categories.map((c) => <option key={c} value={c}>{t(c)}</option>)}</Select>
          <Button variant="ghost" onClick={clearFilters}>{t('Limpiar filtros')}</Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="card relative min-h-[320px] flex-1 overflow-hidden">
          {(() => { const Canvas = mode === '3d' ? MapCanvas3D : MapCanvas; return <Canvas state={state} vb={view.vb} svgRef={svgRef} selectedId={selectedId} hoverId={hoverId} matches={matches} route={activeRoute?.pts ?? null} routeStops={activeRoute?.stops ?? []} drag={drag} showFlow={showFlow} layer={layer} recent={recent} angle={angle}
            onSelect={setSelectedId} onHover={setHoverId} onLocationPointerDown={onLocationPointerDown}
            handlers={{ onWheel: view.onWheel, onPointerDown: view.onPointerDown, onPointerMove: view.onPointerMove, onPointerUp: view.onPointerUp }} /> })()}
          {/* Leyenda */}
          <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-2 rounded-lg bg-white/90 px-3 py-2 text-[11px] shadow backdrop-blur">
            {legendForLayer(layer).map((v) => <span key={v.label} className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm border border-slate-400" style={{ background: v.hatch ? 'repeating-linear-gradient(45deg,#fecaca,#fecaca 2px,#dc2626 2px,#dc2626 4px)' : v.color }} />{t(v.label)}</span>)}
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full bg-warn-500" />{t('Ruta / parada')}</span>
            <span className="flex items-center gap-1"><Layers className="h-3 w-3 text-slate-500" />{t('Rueda: zoom · arrastrar fondo: desplazar · arrastrar hueco con stock: mover')} · <span className="kbd">V</span> 2D/3D · <span className="kbd">Q</span><span className="kbd">E</span> {t('girar')}</span>
          </div>
          {/* Minimapa */}
          {bounds.w / view.vb.w > 1.25 && (
            <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} className="absolute bottom-16 right-2 h-28 w-44 cursor-crosshair rounded-lg border border-slate-300 bg-white/90 shadow backdrop-blur animate-fade-in" aria-label={t('Minimapa')}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const x = bounds.x + ((e.clientX - r.left) / r.width) * bounds.w; const y = bounds.y + ((e.clientY - r.top) / r.height) * bounds.h; view.setVb((v) => ({ ...v, x: x - v.w / 2, y: y - v.h / 2 })) }}>
              {values(state.zones).map((z) => { const zt = ZONE_TYPE[z.type]; if (mode === '3d') return <polygon key={z.id} points={floorPoly(z.x, z.y, z.w, z.h)} fill={zt.fill} stroke={zt.color} strokeWidth="2" />; return <rect key={z.id} x={z.x} y={z.y} width={z.w} height={z.h} fill={zt.fill} stroke={zt.color} strokeWidth="2" /> })}
              {selected && (() => { const c = centerOf(mode, selected); return <circle cx={c.X} cy={c.Y} r={bounds.w / 90} fill="#1d6ff2" /> })()}
              <rect className="minimap-viewport" x={view.vb.x} y={view.vb.y} width={view.vb.w} height={view.vb.h} fill="rgba(29,111,242,0.12)" stroke="#1d6ff2" strokeWidth={bounds.w / 300} />
            </svg>
          )}
          {/* Estado de ruta / búsqueda */}
          {(activeRoute || routeFromId) && (
            <div className="absolute left-2 top-2 flex items-center gap-2 rounded-lg bg-warn-100 px-3 py-1.5 text-xs font-semibold text-warn-600 shadow animate-slide-up">
              <Route className="h-4 w-4" />{routeFromId && !activeRoute ? t('Selecciona la ubicación de destino de la ruta…') : activeRoute?.label}{activeRoute && ` · ${routeLength(activeRoute.pts)} m`}
              <button onClick={() => { setManualRoute(null); setRouteFromId(null); if (params.ruta) navigate('mapa') }} className="ml-1 rounded p-0.5 hover:bg-warn-500/20" aria-label={t('Quitar ruta')}><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          {matchedProduct && (
            <div className="absolute right-2 top-2 w-64 rounded-lg bg-white/95 p-3 text-xs shadow-lg backdrop-blur animate-slide-up">
              <div className="flex items-center gap-2"><img src={matchedProduct.imageUrl} alt="" className="h-9 w-9 rounded" /><div className="min-w-0"><div className="truncate font-semibold text-slate-800">{matchedProduct.name}</div><div className="font-mono text-slate-500">{matchedProduct.sku}</div></div></div>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {productLocs.map((e) => <li key={e.id}><button onClick={() => { setSelectedId(e.locationId); focusLoc(state.locations[e.locationId], 300) }} className="flex w-full items-center justify-between rounded px-2 py-1 font-mono hover:bg-slate-100"><span>{state.locations[e.locationId]?.code}</span><span className="font-bold">{fmtInt(e.quantity)}</span></button></li>)}
                {productLocs.length === 0 && <li className="text-slate-400">{t('Sin stock ubicado')}</li>}
              </ul>
            </div>
          )}
          {hoverId && !drag && !selected && (() => { const l = state.locations[hoverId]; const st = locationStatus(state, l); return (
            <div className="pointer-events-none absolute bottom-14 left-2 rounded-lg bg-navy-950 px-3 py-1.5 text-xs text-white shadow">{l.code} · {t(LOCATION_STATUS[st].label)} · {stockEntriesAt(state, l.id).map((e) => `${state.products[e.productId]?.sku} ×${e.quantity}`).join(', ') || t('vacía')}</div>
          ) })()}
        </div>
        <aside className={cx('card w-full shrink-0 overflow-hidden lg:w-[340px]', !selected && 'hidden lg:block')}>
          {selected ? (
            <LocationPanel key={selected.id} state={state} loc={selected} onClose={() => setSelectedId(null)} onStartDrag={onPanelDrag} onSelectLocation={(id) => { setSelectedId(id); focusLoc(state.locations[id], 300) }}
              routeFromId={routeFromId}
              onRouteFrom={() => { if (routeFromId && routeFromId !== selected.id) { const from = state.locations[routeFromId]; const pts = routeBetween(from, selected); setManualRoute({ pts, stops: [from.id, selected.id], label: `${from.code} → ${selected.code}` }); setRouteFromId(null) } else { setRouteFromId(selected.id); setManualRoute(null) } }} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-500">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-electric-100 text-electric-600"><Move className="h-6 w-6" /></div>
              <p className="font-semibold text-slate-700">{t('Selecciona una ubicación del plano')}</p>
              <p className="text-xs">{t('Verás su ocupación, la mercancía almacenada y podrás arrastrarla a otro hueco. Las ubicaciones se codifican como ZONA-PASILLO-MÓDULO-NIVEL.')}</p>
              <div className="grid w-full grid-cols-2 gap-2 pt-2 text-left text-[11px]">
                {Object.entries(ZONE_TYPE).filter(([k]) => k !== 'oficinas').map(([k, v]) => <span key={k} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border" style={{ background: v.fill, borderColor: v.color }} />{t(v.label)}</span>)}
              </div>
              <div className="flex flex-wrap justify-center gap-1 pt-2">
                <Badge tone="neutral">{t('{n} ubicaciones', { n: locations.length })}</Badge>
                <Badge tone="blue">{t('{n} pasillos', { n: 6 })}</Badge>
                <Badge tone="green">{t('4 muelles')}</Badge>
              </div>
            </div>
          )}
        </aside>
      </div>

      <MoveDialog req={moveReq} state={state} onClose={() => setMoveReq(null)} onDone={(toId) => setSelectedId(toId)} />
      <FlowsPanel open={flowsOpen} onClose={() => setFlowsOpen(false)} />
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t('Mover mercancía mediante formulario')} size="lg">
        <TransferForm state={state} initial={{ fromLocationId: selected?.id }} onDone={() => setFormOpen(false)} />
      </Modal>
    </div>
  )
}

