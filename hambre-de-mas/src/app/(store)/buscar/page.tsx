import type { Metadata } from 'next'
import { CatalogView, PageIntro } from '@/components/catalog/catalog-view'
import type { SearchParams } from '@/lib/catalog/params'

export const metadata: Metadata = {
  title: 'Buscar',
  robots: { index: false, follow: true },
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const q = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? ''
  return (
    <>
      <PageIntro eyebrow="Búsqueda" title={q ? `«${q}»` : 'Buscar kits'} soft={q ? undefined : 'Usa la lupa de arriba.'} />
      <CatalogView
        params={params}
        basePath="/buscar"
        resetHref={q ? `/buscar?q=${encodeURIComponent(q)}` : '/buscar'}
        emptyMessage={q ? `No encontramos kits con «${q}». Prueba con otra palabra, como «pasta» o «sin fuego».` : undefined}
      />
    </>
  )
}
