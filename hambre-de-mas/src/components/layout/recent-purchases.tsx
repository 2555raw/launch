'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from '@/components/ui/icons'
import type { ActivityItem } from '@/app/api/actividad/route'
import { useI18n } from '@/lib/i18n/client'

const SEEN_KEY = 'hdm-seen-purchases'
const FIRST_DELAY = 6_000
const GAP = 40_000
const VISIBLE = 6_500
const REFRESH = 60_000

const readSeen = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]')
  } catch {
    return []
  }
}
const markSeen = (key: string) => {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...readSeen(), key].slice(-50)))
  } catch {}
}

/**
 * Avisos de abajo a la izquierda (/api/actividad): primero «alguien de
 * Madrid ha comprado…» con compras reales de las últimas horas y, detrás,
 * novedades y ventajas de la tienda. Cada aviso sale una vez por sesión,
 * con unos 40 segundos entre uno y otro.
 */
export function RecentPurchases() {
  const { t } = useI18n()
  const pathname = usePathname()
  const [current, setCurrent] = useState<(ActivityItem & { minutes: number }) | null>(null)
  const queue = useRef<ActivityItem[]>([])
  const lastShown = useRef(0)
  const hidden = /^\/(checkout|cesta)/.test(pathname)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/actividad', { cache: 'no-store' })
        const data = (await res.json()) as { items?: ActivityItem[] }
        if (cancelled) return
        const seen = new Set(readSeen())
        const queued = new Set(queue.current.map((p) => p.key))
        const fresh = (data.items ?? []).filter((p) => !seen.has(p.key) && !queued.has(p.key))
        // Las compras reales van siempre delante
        queue.current = [...fresh.filter((p) => p.kind === 'purchase'), ...queue.current, ...fresh.filter((p) => p.kind !== 'purchase')]
      } catch {}
    }
    load()
    const refresh = setInterval(load, REFRESH)
    const started = Date.now()
    const tick = setInterval(() => {
      // No tapar el aviso de cookies ni repetir antes de tiempo
      if (!document.cookie.includes('hdm_consent=')) return
      const now = Date.now()
      if (now - started < FIRST_DELAY || now - lastShown.current < GAP) return
      const next = queue.current.shift()
      if (!next) return
      lastShown.current = now
      markSeen(next.key)
      setCurrent({ ...next, minutes: next.paidAt ? Math.max(1, Math.round((now - new Date(next.paidAt).getTime()) / 60_000)) : 0 })
    }, 2_000)
    return () => {
      cancelled = true
      clearInterval(refresh)
      clearInterval(tick)
    }
  }, [])

  useEffect(() => {
    if (!current) return
    const id = setTimeout(() => setCurrent(null), VISIBLE)
    return () => clearTimeout(id)
  }, [current])

  const ago = (minutes: number) => {
    if (minutes < 60) return t({ es: `hace ${minutes} min`, en: `${minutes} min ago` })
    const hours = Math.round(minutes / 60)
    return t({ es: `hace ${hours} h`, en: `${hours} h ago` })
  }

  return (
    <AnimatePresence>
      {current && !hidden && (
        <motion.div
          key={current.key}
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: [0.28, 0.11, 0.32, 1] }}
          className="fixed bottom-4 left-4 z-[55] flex w-[min(340px,calc(100vw-6rem))] items-center gap-3 rounded-2xl bg-white p-2.5 pr-9 shadow-float ring-1 ring-line sm:bottom-5 sm:left-5"
        >
          {current.image && (
            <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-mist">
              <Image src={current.image} alt="" fill sizes="48px" className="object-cover" />
            </span>
          )}
          <span className="min-w-0 text-[13px] leading-snug">
            <span className="block text-ash-ink">
              {current.kind === 'purchase'
                ? current.province
                  ? t({ es: `Alguien de ${current.province} ha comprado`, en: `Someone in ${current.province} bought` })
                  : t({ es: 'Alguien ha comprado', en: 'Someone bought' })
                : current.eyebrow}
            </span>
            {current.href ? (
              <Link href={current.href} className="block truncate font-semibold text-ink hover:text-teja">
                {current.title}
              </Link>
            ) : (
              <span className="block truncate font-semibold text-ink">{current.title}</span>
            )}
            <span className="block truncate text-[12px] text-ash">{current.kind === 'purchase' ? ago(current.minutes) : current.meta}</span>
          </span>
          <button
            type="button"
            onClick={() => setCurrent(null)}
            className="absolute top-2 right-2 grid size-6 place-items-center rounded-full text-ash transition-colors hover:bg-mist hover:text-ink"
            aria-label={t({ es: 'Cerrar aviso', en: 'Close notice' })}
          >
            <CloseIcon size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
