import type { Metadata } from 'next'
import { CatalogView, PageIntro } from '@/components/catalog/catalog-view'
import type { SearchParams } from '@/lib/catalog/params'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t({ es: 'Buscar', en: 'Search' }), robots: { index: false, follow: true } }
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? ''
  const { t } = await getI18n()
  return (
    <>
      <PageIntro
        eyebrow={t({ es: 'Búsqueda', en: 'Search' })}
        title={q ? t({ es: `«${q}»`, en: `“${q}”` }) : t({ es: 'Buscar kits', en: 'Search kits' })}
        soft={q ? undefined : t({ es: 'Usa la lupa de arriba.', en: 'Use the magnifying glass above.' })}
      />
      <CatalogView
        params={params}
        basePath="/buscar"
        resetHref={q ? `/buscar?q=${encodeURIComponent(q)}` : '/buscar'}
        emptyMessage={
          q
            ? t({
                es: `No encontramos kits con «${q}». Prueba con otra palabra, como «pasta» o «sin fuego».`,
                en: `No kits found for “${q}”. Try another word, like “pasta” or “pizza”.`,
              })
            : undefined
        }
      />
    </>
  )
}
