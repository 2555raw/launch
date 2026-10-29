import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CatalogView, PageIntro } from '@/components/catalog/catalog-view'
import { getCatalog } from '@/lib/catalog'
import type { SearchParams } from '@/lib/catalog/params'
import { GiftIcon } from '@/components/ui/icons'
import { commerce } from '@/lib/config/commerce'
import { getI18n } from '@/lib/i18n/server'

export async function generateStaticParams() {
  try {
    const { categories } = await getCatalog().listSitemapEntries()
    return categories.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const category = await getCatalog().getCategory(slug)
  const { t } = await getI18n()
  if (!category) return { title: t({ es: 'Categoría no encontrada', en: 'Category not found' }) }
  return {
    title: `${category.name}${category.level ? ` · ${t({ es: 'Nivel', en: 'Level' })} ${category.level}` : ''}`,
    description: category.description ?? category.tagline ?? undefined,
    alternates: { canonical: `/categoria/${category.slug}` },
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params
  const category = await getCatalog().getCategory(slug)
  if (!category) notFound()
  const { t } = await getI18n()
  return (
    <>
      <PageIntro
        eyebrow={category.level ? t({ es: `Nivel ${category.level}`, en: `Level ${category.level}` }) : t({ es: 'Cada mes', en: 'Every month' })}
        title={`${category.name}.`} soft={category.tagline ?? undefined}>
        {category.description && <p className="mt-5 max-w-2xl text-lg text-ash-ink">{category.description}</p>}
        {category.level && commerce.bundleMinKits > 0 && commerce.bundlePercent > 0 && (
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-almendra-soft px-4 py-2 text-sm font-medium text-teja">
            <GiftIcon size={16} />
            {t({
              es: `Pack: ${commerce.bundleMinKits} kits de este nivel, −${commerce.bundlePercent} % automático en la cesta`,
              en: `Bundle: ${commerce.bundleMinKits} kits from this level, ${commerce.bundlePercent}% off automatically in your bag`,
            })}
          </p>
        )}
      </PageIntro>
      <CatalogView params={await searchParams} base={{ category: category.slug }} basePath={`/categoria/${category.slug}`} lockCategory />
    </>
  )
}
