import type { Metadata } from 'next'
import { CatalogView, PageIntro } from '@/components/catalog/catalog-view'
import type { SearchParams } from '@/lib/catalog/params'

export const metadata: Metadata = {
  title: 'Tienda de kits de cocina',
  description: 'Todos los kits de cocina de Hambre de Más por nivel, tiempo, dieta y precio. Envío gratis desde 40 €.',
  alternates: { canonical: '/tienda' },
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const featured = params.destacados === '1'
  const newest = params.orden === 'novedades'
  return (
    <>
      <PageIntro
        eyebrow="Tienda"
        title={featured ? 'Destacados.' : newest ? 'Novedades.' : 'Todos los kits.'}
        soft={featured ? 'Los que más os flipan.' : newest ? 'Recién salidos del horno.' : 'Elige, cocina, sube de nivel.'}
      />
      <CatalogView params={params} basePath="/tienda" />
    </>
  )
}
