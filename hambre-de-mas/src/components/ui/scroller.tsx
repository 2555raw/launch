'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

/**
 * Fila con desplazamiento horizontal al estilo de la Apple Store, con
 * flechas en escritorio y gesto táctil en móvil.
 */
export function Scroller({ children, label, className }: { children: React.ReactNode; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      setCanPrev(el.scrollLeft > 4)
      setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])

  const scroll = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <div className={cn('relative', className)}>
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="scrollbar-none flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 pt-2 pb-10 sm:scroll-px-6 sm:px-6 lg:scroll-px-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))] lg:px-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))]"
      >
        {children}
      </div>
      <div
        className={cn(
          'container-page pointer-events-none absolute inset-x-0 bottom-0 hidden justify-end gap-3',
          (canPrev || canNext) && 'lg:flex',
        )}
      >
        <button
          type="button"
          onClick={() => scroll(-1)}
          disabled={!canPrev}
          aria-label="Anterior"
          className="pointer-events-auto grid size-9 place-items-center rounded-full bg-mist text-ink transition-[background-color,opacity] hover:bg-line disabled:opacity-35"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          disabled={!canNext}
          aria-label="Siguiente"
          className="pointer-events-auto grid size-9 place-items-center rounded-full bg-mist text-ink transition-[background-color,opacity] hover:bg-line disabled:opacity-35"
        >
          <ChevronRightIcon size={18} />
        </button>
      </div>
    </div>
  )
}
