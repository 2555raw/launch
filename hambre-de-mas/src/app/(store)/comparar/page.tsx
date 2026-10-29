import type { Metadata } from 'next'
import { KitCompare, type CompareKit } from '@/components/compare/kit-compare'
import { getCatalog } from '@/lib/catalog'
import type { SearchParams } from '@/lib/catalog/params'
import { getI18n } from '@/lib/i18n/server'
import { formatPrice } from '@/lib/money'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return {
    title: t({ es: 'Comparar kits', en: 'Compare kits' }),
    description: t({
      es: 'Pon hasta tres kits lado a lado: precio, tiempo, dificultad, calorías, proteína y alérgenos.',
      en: 'Put up to three kits side by side: price, time, difficulty, calories, protein and allergens.',
    }),
    alternates: { canonical: '/comparar' },
  }
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const { locale, t } = await getI18n()
  const { items } = await getCatalog().listProducts({ sort: 'popular', limit: 100 })
  const kits: CompareKit[] = items
    .filter((p) => p.category?.level)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      levelName: p.category?.name ?? null,
      image: p.image?.url ?? null,
      priceCents: p.priceCents,
      price: formatPrice(p.priceCents, locale),
      minutes: p.attributes.minutes ?? null,
      difficulty: p.attributes.difficulty ?? null,
      heat: p.attributes.heat ?? null,
      fresh: p.attributes.storage === 'fresco',
      nutrition: p.attributes.nutrition ?? null,
      allergens: p.allergens,
      tags: p.tags,
    }))

  const requested = (Array.isArray(params.kits) ? params.kits[0] : params.kits)?.split(',') ?? []
  const valid = [...new Set(requested)].filter((slug) => kits.some((k) => k.slug === slug)).slice(0, 3)
  // Sin selección: el más vendido de cada nivel
  const initial = valid.length
    ? valid
    : [...new Set(items.filter((p) => p.category?.level).map((p) => p.category!.level))]
        .sort()
        .flatMap((level) => items.find((p) => p.category?.level === level)?.slug ?? [])
        .slice(0, 3)

  return (
    <div className="container-page pt-12 pb-24">
      <p className="eyebrow">{t({ es: 'Tienda', en: 'Shop' })}</p>
      <h1 className="mt-3 max-w-4xl font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
        {t({ es: 'Comparar kits.', en: 'Compare kits.' })} <span className="text-chef">{t({ es: 'Hasta tres a la vez.', en: 'Up to three at once.' })}</span>
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ash-ink">
        {t({
          es: 'Quita o añade kits para ver cuál es más rápido, más barato o tiene más proteína. Los valores nutricionales son aproximados, por ración.',
          en: 'Remove or add kits to see which is fastest, cheapest or has the most protein. Nutrition values are approximate, per serving.',
        })}
      </p>
      <div className="mt-10">
        <KitCompare kits={kits} initial={initial} />
      </div>
    </div>
  )
}
