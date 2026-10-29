'use client'

import createGlobe from 'cobe'
import { useEffect, useRef } from 'react'

export type GlobePoint = { id: string; label: string; detail: string; lat: number; lng: number; orders: number }

/** Ángulos de la bola para dejar un punto de frente. */
const facing = (lat: number, lng: number): [number, number] => [Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2), (lat * Math.PI) / 180]
const [SPAIN_PHI, SPAIN_THETA] = facing(40.2, -3.7)
/** Cuántos puntos llevan etiqueta (los de más pedidos); el resto, solo el punto. */
const MAX_LABELS = 8

/**
 * Bola del mundo oscura que se gira arrastrando, con un punto rojo que late
 * por cada provincia desde la que han comprado (más grande cuantos más
 * pedidos) y una etiqueta «Madrid · 12 pedidos» pegada a los principales.
 * Arranca de frente a España, gira sola muy despacio, se para con «reducir
 * movimiento» y solo se anima mientras está a la vista.
 */
export function PurchaseGlobe({ points, label }: { points: GlobePoint[]; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelsRef = useRef<(HTMLSpanElement | null)[]>([])
  const drag = useRef<{ x: number; y: number } | null>(null)
  const offset = useRef({ phi: 0, theta: 0 })
  const view = useRef({ phi: SPAIN_PHI, theta: SPAIN_THETA })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const max = Math.max(1, ...points.map((p) => p.orders))
    const baseSize = points.map((p) => 0.03 + 0.05 * Math.sqrt(p.orders / max))
    let globe: ReturnType<typeof createGlobe> | null = null
    let frame = 0
    let visible = false
    let tick = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const size = () => canvas.offsetWidth * dpr
    const root = document.documentElement

    const markers = (pulse: number) =>
      points.map((p, i) => ({
        id: p.id,
        location: [p.lat, p.lng] as [number, number],
        size: baseSize[i]! * (1 + 0.18 * Math.sin(pulse + i * 0.9)),
      }))

    // cobe deja junto al lienzo un punto invisible por marcador: ahí colgamos las etiquetas
    const placeLabels = () => {
      const anchors = [...(canvas.parentElement?.children ?? [])].filter((el) => el !== canvas) as HTMLElement[]
      const style = getComputedStyle(root)
      labelsRef.current.forEach((el, i) => {
        const anchor = anchors[i]
        if (!el || !anchor) return
        el.style.left = anchor.style.left
        el.style.top = anchor.style.top
        el.style.opacity = style.getPropertyValue(`--cobe-visible-${points[i]!.id}`).trim() ? '1' : '0'
      })
    }

    const loop = () => {
      if (!globe || !visible) return
      tick += 1
      if (!drag.current && !reduced) view.current.phi += 0.0016
      globe.update({
        phi: view.current.phi + offset.current.phi,
        theta: Math.max(-0.6, Math.min(1.1, view.current.theta + offset.current.theta)),
        width: size(),
        height: size(),
        ...(reduced ? {} : { markers: markers(tick / 18) }),
      })
      placeLabels()
      frame = requestAnimationFrame(loop)
    }

    const start = () => {
      if (!globe) {
        globe = createGlobe(canvas, {
          devicePixelRatio: dpr,
          width: size(),
          height: size(),
          phi: view.current.phi,
          theta: view.current.theta,
          dark: 1,
          diffuse: 1.6,
          scale: 1,
          mapSamples: 24000,
          mapBrightness: 7,
          mapBaseBrightness: 0.04,
          baseColor: [0.22, 0.2, 0.19],
          markerColor: [0.95, 0.27, 0.2],
          glowColor: [0.42, 0.16, 0.12],
          markerElevation: 0.015,
          markers: markers(0),
        })
        canvas.style.opacity = '1'
      }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(loop)
    }

    // Solo se anima mientras se ve
    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting)
      if (visible) start()
    })
    io.observe(canvas)
    return () => {
      io.disconnect()
      cancelAnimationFrame(frame)
      globe?.destroy()
    }
  }, [points])

  const release = () => {
    if (!drag.current) return
    view.current.phi += offset.current.phi
    view.current.theta = Math.max(-0.6, Math.min(1.1, view.current.theta + offset.current.theta))
    offset.current = { phi: 0, theta: 0 }
    drag.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
  }

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="size-full cursor-grab touch-pan-y opacity-0 transition-opacity duration-1000 [contain:layout_paint_size]"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY }
          e.currentTarget.style.cursor = 'grabbing'
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          offset.current = { phi: (e.clientX - drag.current.x) / 180, theta: (e.clientY - drag.current.y) / 360 }
        }}
        onPointerUp={release}
        onPointerCancel={release}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {points.slice(0, MAX_LABELS).map((p, i) => (
          <span
            key={p.id}
            ref={(el) => {
              labelsRef.current[i] = el
            }}
            className="absolute -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-white opacity-0 ring-1 ring-white/20 backdrop-blur-md transition-opacity duration-300"
          >
            {p.label} <span className="text-white/60">· {p.detail}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
