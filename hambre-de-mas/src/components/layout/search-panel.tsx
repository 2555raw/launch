'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { ArrowRightIcon, SearchIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { useI18n } from '@/lib/i18n/client'
import { formatPrice } from '@/lib/money'

type Suggestion = { slug: string; name: string; subtitle: string | null; priceCents: number; imageUrl: string | null }

const quickLinks = [
  { href: '/tienda?nuevos=1', label: { es: 'Novedades', en: 'New arrivals' } },
  { href: '/categoria/primer-bocado', label: { es: 'Kits sin fuego', en: 'No-cook kits' } },
  { href: '/tienda?dieta=vegano', label: { es: 'Recetas veganas', en: 'Vegan recipes' } },
  { href: '/categoria/caja-sorpresa', label: { es: 'Caja sorpresa', en: 'Surprise box' } },
]

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { locale, t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Los resultados de una búsqueda anterior no se muestran si el texto es corto.
  const visible = q.trim().length < 2 ? [] : results

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        const data = (await res.json()) as { results: Suggestion[] }
        setResults(data.results)
      } catch {
        // búsqueda cancelada o sin conexión
      } finally {
        setLoading(false)
      }
    }, 180)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q])

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.28, 0.11, 0.32, 1] }}
      className="absolute inset-x-0 top-full z-20 overflow-hidden bg-white shadow-[0_20px_40px_-20px_rgb(0_0_0/0.15)]"
    >
      <div className="container-page max-w-3xl pt-4 pb-10">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            if (q.trim()) {
              router.push(`/buscar?q=${encodeURIComponent(q.trim())}`)
              onClose()
            }
          }}
          className="flex items-center gap-3 border-b border-line pb-3"
        >
          <SearchIcon size={24} className="shrink-0 text-ash" />
          <label htmlFor="buscador" className="sr-only">
            {t({ es: 'Buscar kits', en: 'Search kits' })}
          </label>
          <input
            ref={inputRef}
            id="buscador"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t({ es: 'Buscar kits, recetas, ingredientes…', en: 'Search kits, recipes, ingredients…' })}
            autoComplete="off"
            aria-controls={listId}
            className="w-full bg-transparent font-display text-2xl font-semibold text-ink placeholder:text-ash/70 focus:outline-none sm:text-[28px]"
          />
        </form>

        <div id={listId} aria-live="polite" className="mt-6">
          {q.trim().length < 2 ? (
            <>
              <p className="mb-3 text-xs text-ash-ink">{t({ es: 'Enlaces rápidos', en: 'Quick links' })}</p>
              <ul className="space-y-1">
                {quickLinks.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} onClick={onClose} className="flex items-center gap-2 py-1.5 text-sm font-medium hover:text-teja">
                      <ArrowRightIcon size={14} className="text-ash" /> {t(l.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : visible.length > 0 ? (
            <>
              <p className="mb-3 text-xs text-ash-ink">{t({ es: 'Sugerencias', en: 'Suggestions' })}</p>
              <ul className="divide-y divide-line">
                {visible.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/producto/${r.slug}`} onClick={onClose} className="group flex items-center gap-4 py-3">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-mist">
                        {r.imageUrl && <ProductImage src={r.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold group-hover:text-teja">{r.name}</p>
                        <p className="truncate text-xs text-ash-ink">{r.subtitle}</p>
                      </div>
                      <span className="text-sm tabular-nums">{formatPrice(r.priceCents, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={`/buscar?q=${encodeURIComponent(q.trim())}`}
                onClick={onClose}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teja hover:underline"
              >
                {t({ es: 'Ver todos los resultados', en: 'See all results' })} <ArrowRightIcon size={14} />
              </Link>
            </>
          ) : (
            !loading && (
              <p className="text-sm text-ash-ink">
                {t({
                  es: `No encontramos nada con «${q.trim()}». Prueba con «ramen» o «pizza».`,
                  en: `Nothing found for “${q.trim()}”. Try “ramen” or “pizza”.`,
                })}
              </p>
            )
          )}
        </div>
      </div>
    </motion.div>
  )
}
