'use client'

import createGlobe from 'cobe'
import { useEffect, useRef } from 'react'

export type GlobePoint = { lat: number; lng: number; orders: number }

/** Ángulos de la bola para dejar un punto de frente. */
const facing = (lat: number, lng: number): [number, number] => [Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2), (lat * Math.PI) / 180]
const [SPAIN_PHI, SPAIN_THETA] = facing(40.2, -3.7)

/**
 * Bola del mundo que se gira arrastrando, con un punto rojo por provincia
 * desde la que han comprado (más grande cuantos más pedidos). Arranca de
 * frente a España, gira sola muy despacio y no se anima con «reducir
 * movimiento». Solo se anima mientras está a la vista.
 */
export function PurchaseGlobe({ points, label }: { points: GlobePoint[]; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const offset = useRef({ phi: 0, theta: 0 })
  const view = useRef({ phi: SPAIN_PHI, theta: SPAIN_THETA })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const max = Math.max(1, ...points.map((p) => p.orders))
    let globe: ReturnType<typeof createGlobe> | null = null
    let frame = 0
    let visible = false
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const size = () => canvas.offsetWidth * dpr

    const loop = () => {
      if (!globe || !visible) return
      if (!drag.current && !reduced) view.current.phi += 0.0016
      globe.update({
        phi: view.current.phi + offset.current.phi,
        theta: Math.max(-0.6, Math.min(1.1, view.current.theta + offset.current.theta)),
        width: size(),
        height: size(),
      })
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
          dark: 0,
          diffuse: 1.2,
          scale: 1,
          mapSamples: 20000,
          mapBrightness: 5.5,
          mapBaseBrightness: 0.02,
          baseColor: [1, 1, 1],
          markerColor: [0.902, 0.227, 0.18],
          glowColor: [0.96, 0.94, 0.92],
          markerElevation: 0.01,
          markers: points.map((p) => ({ location: [p.lat, p.lng], size: 0.025 + 0.045 * Math.sqrt(p.orders / max) })),
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
    </div>
  )
}
