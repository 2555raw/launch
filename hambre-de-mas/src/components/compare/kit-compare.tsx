'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { AllergenStrip } from '@/components/product/allergen-icons'
import { CloseIcon, PlusIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import type { Allergen } from '@/lib/allergens'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'
import type { Localized } from '@/lib/i18n/config'
import type { Heat, Nutrition } from '@/lib/types'

export type CompareKit = {
  slug: string
  name: string
  levelName: string | null
  image: string | null
  priceCents: number
  price: string
  minutes: number | null
  difficulty: number | null
  heat: Heat | null
  fresh: boolean
  nutrition: Nutrition | null
  allergens: Allergen[]
  tags: string[]
}

const MAX = 3

const heatLabel: Record<Heat, Localized> = {
  'sin-fuego': { es: 'Sin fuego', en: 'No heat' },
  microondas: { es: 'Microondas', en: 'Microwave' },
  sarten: { es: 'Sartén', en: 'Frying pan' },
  cazo: { es: 'Cazo', en: 'Pot' },
  horno: { es: 'Horno', en: 'Oven' },
}
const difficultyLabel: Record<number, Localized> = {
  1: { es: 'Fácil', en: 'Easy' },
  2: { es: 'Media', en: 'Medium' },
  3: { es: 'Reto', en: 'Challenge' },
}
const tagLabel: Record<string, Localized> = {
  vegano: { es: 'Vegano', en: 'Vegan' },
  vegetariano: { es: 'Vegetariano', en: 'Vegetarian' },
  'sin-gluten': { es: 'Sin gluten', en: 'Gluten-free' },
  picante: { es: 'Picante', en: 'Spicy' },
  'alto-en-proteina': { es: 'Alto en proteína', en: 'High protein' },
}

type Row = {
  label: Localized
  value: (k: CompareKit) => React.ReactNode
  /** Para marcar al «ganador» de la fila: menor o mayor es mejor. */
  best?: { of: (k: CompareKit) => number | null; prefer: 'min' | 'max'; badge: Localized }
}

/** Comparador: hasta tres kits lado a lado. La selección va en la URL (?kits=a,b,c) para poder compartirla. */
export function KitCompare({ kits, initial }: { kits: CompareKit[]; initial: string[] }) {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const [selected, setSelected] = useState<string[]>(initial)
  const [picking, setPicking] = useState(false)
  const chosen = selected.flatMap((slug) => kits.filter((k) => k.slug === slug))

  const update = (next: string[]) => {
    setSelected(next)
    setPicking(false)
    router.replace(next.length ? `${pathname}?kits=${next.join(',')}` : pathname, { scroll: false })
  }

  const rows: Row[] = [
    { label: { es: 'Nivel', en: 'Level' }, value: (k) => k.levelName ?? '—' },
    {
      label: { es: 'Precio', en: 'Price' },
      value: (k) => t({ es: `Desde ${k.price}`, en: `From ${k.price}` }),
      best: { of: (k) => k.priceCents, prefer: 'min', badge: { es: 'Más barato', en: 'Cheapest' } },
    },
    {
      label: { es: 'Tiempo', en: 'Time' },
      value: (k) => (k.minutes ? `${k.minutes} min` : '—'),
      best: { of: (k) => k.minutes, prefer: 'min', badge: { es: 'Más rápido', en: 'Fastest' } },
    },
    { label: { es: 'Dificultad', en: 'Difficulty' }, value: (k) => (k.difficulty ? t(difficultyLabel[k.difficulty]!) : '—') },
    { label: { es: 'Fuego', en: 'Heat' }, value: (k) => (k.heat ? t(heatLabel[k.heat]) : '—') },
    {
      label: { es: 'Conservación', en: 'Storage' },
      value: (k) => (k.fresh ? t({ es: 'Con frescos · refrigerado', en: 'Fresh · chilled' }) : t({ es: '100 % seco', en: '100% dry' })),
    },
    {
      label: { es: 'Calorías', en: 'Calories' },
      value: (k) => (k.nutrition ? `${k.nutrition.kcal} kcal` : '—'),
      best: { of: (k) => k.nutrition?.kcal ?? null, prefer: 'min', badge: { es: 'Más ligero', en: 'Lightest' } },
    },
    {
      label: { es: 'Proteína', en: 'Protein' },
      value: (k) => (k.nutrition ? `${k.nutrition.protein} g` : '—'),
      best: { of: (k) => k.nutrition?.protein ?? null, prefer: 'max', badge: { es: 'Más proteína', en: 'Most protein' } },
    },
    { label: { es: 'Hidratos', en: 'Carbs' }, value: (k) => (k.nutrition ? `${k.nutrition.carbs} g` : '—') },
    { label: { es: 'Grasas', en: 'Fat' }, value: (k) => (k.nutrition ? `${k.nutrition.fat} g` : '—') },
    {
      label: { es: 'Etiquetas', en: 'Tags' },
      value: (k) =>
        k.tags.length ? (
          <span className="flex flex-wrap gap-1">
            {k.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-mist px-2 py-0.5 text-xs">
                {tagLabel[tag] ? t(tagLabel[tag]) : tag}
              </span>
            ))}
          </span>
        ) : (
          '—'
        ),
    },
    { label: { es: 'Alérgenos', en: 'Allergens' }, value: (k) => (k.allergens.length ? <AllergenStrip codes={k.allergens} size={20} /> : '—') },
  ]

  const winner = (row: Row) => {
    if (!row.best || chosen.length < 2) return null
    const values = chosen.map((k) => row.best!.of(k)).filter((v): v is number => v != null)
    if (values.length < 2) return null
    const target = row.best.prefer === 'min' ? Math.min(...values) : Math.max(...values)
    // Sin ganador si empatan todos
    return values.every((v) => v === target) ? null : target
  }

  const available = kits.filter((k) => !selected.includes(k.slug))
  const cols = Math.max(chosen.length + (chosen.length < MAX ? 1 : 0), 2)

  return (
    <div className="overflow-x-auto pb-4">
      <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-x-3 text-left">
        <colgroup>
          <col className="w-[140px] sm:w-[180px]" />
          {Array.from({ length: cols }, (_, i) => (
            <col key={i} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              {t({ es: 'Característica', en: 'Feature' })}
            </th>
            {chosen.map((k) => (
              <th key={k.slug} scope="col" className="align-top font-normal">
                <div className="relative">
                  <Link href={`/producto/${k.slug}`} className="group block">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[20px] bg-mist">
                      {k.image && <ProductImage src={k.image} alt="" fill sizes="280px" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
                    </div>
                    <p className="mt-3 font-display text-lg leading-snug font-bold group-hover:text-teja">{k.name}</p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => update(selected.filter((s) => s !== k.slug))}
                    className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur hover:bg-white"
                    aria-label={t({ es: `Quitar ${k.name}`, en: `Remove ${k.name}` })}
                  >
                    <CloseIcon size={15} />
                  </button>
                </div>
              </th>
            ))}
            {chosen.length < MAX && (
              <th scope="col" className="align-top font-normal">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPicking((p) => !p)}
                    aria-expanded={picking}
                    className="grid aspect-[4/3] w-full place-items-center rounded-[20px] border-2 border-dashed border-line-strong text-ash-ink transition-colors hover:border-ink hover:text-ink"
                  >
                    <span className="flex flex-col items-center gap-2 text-sm font-semibold">
                      <span className="grid size-11 place-items-center rounded-full bg-mist">
                        <PlusIcon />
                      </span>
                      {t({ es: 'Añadir kit', en: 'Add a kit' })}
                    </span>
                  </button>
                  <AnimatePresence>
                    {picking && (
                      <motion.ul
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-float ring-1 ring-line"
                      >
                        {available.map((k) => (
                          <li key={k.slug}>
                            <button
                              type="button"
                              onClick={() => update([...selected, k.slug])}
                              className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-mist"
                            >
                              <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-mist">
                                {k.image && <ProductImage src={k.image} alt="" fill sizes="40px" className="object-cover" />}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-semibold">{k.name}</span>
                                <span className="block text-xs text-ash-ink">{k.levelName}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              </th>
            )}
            {chosen.length === 0 && <th aria-hidden />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const best = winner(row)
            return (
              <tr key={row.label.es}>
                <th scope="row" className="border-b border-line py-3.5 pr-2 align-top text-[13px] font-medium text-ash-ink">
                  {t(row.label)}
                </th>
                {chosen.map((k) => {
                  const isBest = best != null && row.best?.of(k) === best
                  return (
                    <td key={k.slug} className={cn('border-b border-line py-3.5 align-top text-[15px]', isBest && 'font-semibold')}>
                      {row.value(k)}
                      {isBest && (
                        <span className="ml-2 inline-block rounded-full bg-hoja/20 px-2 py-0.5 text-[11px] font-semibold text-hoja-deep">{t(row.best!.badge)}</span>
                      )}
                    </td>
                  )
                })}
                {chosen.length < MAX && <td className="border-b border-line" />}
                {chosen.length === 0 && <td className="border-b border-line" />}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
