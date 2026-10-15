import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent } from 'react'
export interface ViewBox { x: number; y: number; w: number; h: number }

export function useViewBox(svgRef: React.RefObject<SVGSVGElement | null>, FULL: ViewBox & { zoom?: number }) {
  const [vb, setVb] = useState<ViewBox>(FULL)
  const panRef = useRef<{ x: number; y: number; vb: ViewBox } | null>(null)
  const pinchRef = useRef<{ d: number; vb: ViewBox } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  const clientToMap = useCallback((cx: number, cy: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const r = svg.getBoundingClientRect()
    return { x: vb.x + ((cx - r.left) / r.width) * vb.w, y: vb.y + ((cy - r.top) / r.height) * vb.h }
  }, [svgRef, vb])

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    setVb((v) => {
      const svg = svgRef.current
      let px = v.x + v.w / 2, py = v.y + v.h / 2
      if (svg && cx !== undefined && cy !== undefined) {
        const r = svg.getBoundingClientRect()
        px = v.x + ((cx - r.left) / r.width) * v.w
        py = v.y + ((cy - r.top) / r.height) * v.h
      }
      const w = Math.min(FULL.w * 1.5, Math.max(120, v.w * factor))
      const h = w * (v.h / v.w)
      return { x: px - (px - v.x) * (w / v.w), y: py - (py - v.y) * (h / v.h), w, h }
    })
  }, [svgRef, FULL.w])

  const onWheel = useCallback((e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    zoomAt(e.deltaY > 0 ? 1.12 : 0.89, e.clientX, e.clientY)
  }, [zoomAt])

  const onPointerDown = useCallback((e: RPointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchRef.current = { d: Math.hypot(a.x - b.x, a.y - b.y), vb }
      panRef.current = null
      return
    }
    panRef.current = { x: e.clientX, y: e.clientY, vb }
  }, [vb])

  const onPointerMove = useCallback((e: RPointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const svg = svgRef.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    if (pinchRef.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const f = pinchRef.current.d / Math.max(1, d)
      const base = pinchRef.current.vb
      const w = Math.min(FULL.w * 1.5, Math.max(120, base.w * f))
      const h = w * (base.h / base.w)
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
      const px = base.x + ((mx - r.left) / r.width) * base.w
      const py = base.y + ((my - r.top) / r.height) * base.h
      setVb({ x: px - (px - base.x) * (w / base.w), y: py - (py - base.y) * (h / base.h), w, h })
      return
    }
    if (!panRef.current) return
    const dx = ((e.clientX - panRef.current.x) / r.width) * panRef.current.vb.w
    const dy = ((e.clientY - panRef.current.y) / r.height) * panRef.current.vb.h
    setVb({ ...panRef.current.vb, x: panRef.current.vb.x - dx, y: panRef.current.vb.y - dy })
  }, [svgRef])

  const onPointerUp = useCallback((e: RPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchRef.current = null
    panRef.current = null
  }, [])

  /** Ajusta el plano al tamaño del lienzo conservando la proporción (sin bandas vacías). */
  const reset = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return setVb(FULL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const r = svg.getBoundingClientRect()
    const aspect = r.width / Math.max(1, r.height)
    const mapAspect = FULL.w / FULL.h
    const z = FULL.zoom ?? 1
    let box: ViewBox
    if (aspect >= mapAspect) {
      const w = FULL.h * aspect
      box = { x: FULL.x - (w - FULL.w) / 2, y: FULL.y, w, h: FULL.h }
    } else {
      const h = FULL.w / aspect
      box = { x: FULL.x, y: FULL.y - (h - FULL.h) / 2, w: FULL.w, h }
    }
    // Acercamiento inicial opcional hacia el centro
    const w = box.w / z, h = box.h / z
    setVb({ x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2 - (z > 1 ? h * 0.02 : 0), w, h })
  }, [svgRef, FULL.x, FULL.y, FULL.w, FULL.h, FULL.zoom])
  useEffect(() => {
    reset()
    const svg = svgRef.current
    if (!svg || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => reset())
    ro.observe(svg)
    return () => ro.disconnect()
  }, [reset, svgRef])
  const focusOn = useCallback((x: number, y: number, w = 320) => {
    setVb((v) => { const h = w * (v.h / v.w); return { x: x - w / 2, y: y - h / 2, w, h } })
  }, [])

  const panBy = useCallback((dx: number, dy: number) => setVb((v) => ({ ...v, x: v.x + v.w * dx, y: v.y + v.h * dy })), [])

  return { vb, setVb, zoomAt, onWheel, onPointerDown, onPointerMove, onPointerUp, reset, focusOn, clientToMap, panBy, isPanning: () => !!panRef.current }
}
