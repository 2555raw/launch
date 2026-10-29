'use client'

import { useEffect, useRef } from 'react'

/**
 * Contenedor de la portada que sigue al ratón: deja en --mx y --my un valor
 * entre -1 y 1 para que tarjetas e ingredientes se muevan con profundidad.
 * Con «reducir movimiento» o en pantallas táctiles no hace nada.
 */
export function HeroStage({ className, style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return
    let frame = 0
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--mx', ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3))
        el.style.setProperty('--my', ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3))
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])
  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}
