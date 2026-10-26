import { Hero } from '@/components/home/hero'
import {
  Benefits,
  BestSellers,
  BrandStory,
  HowItWorks,
  LevelsRow,
  NewArrivals,
  NewsletterSection,
  ProductGridSection,
  StoreIntro,
  VerifiedReviews,
} from '@/components/home/sections'
import { JsonLd } from '@/components/seo/json-ld'
import { getCatalog } from '@/lib/catalog'
import { company, site } from '@/lib/config/site'

// El catálogo se regenera como mucho cada minuto (ISR).
export const revalidate = 60

export default async function HomePage() {
  const catalog = getCatalog()
  const [categories, newest, featured, popular, reviews] = await Promise.all([
    catalog.listCategories(),
    catalog.listProducts({ sort: 'newest', limit: 6 }),
    catalog.listProducts({ featured: true, sort: 'popular', limit: 8 }),
    catalog.listProducts({ sort: 'popular', limit: 6 }),
    catalog.listRecentReviews(3),
  ])

  const heroProduct = featured.items[0] ?? popular.items[0] ?? null
  const featuredGrid = featured.items.filter((p) => p.id !== heroProduct?.id).slice(0, 4)

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: company.legalName ?? site.name,
          url: site.url,
          logo: `${site.url}/brand/logo-720.png`,
          sameAs: [site.social.instagram, site.social.tiktok],
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: site.name,
          url: site.url,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${site.url}/buscar?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        }}
      />
      <Hero product={heroProduct} />
      <StoreIntro />
      <LevelsRow categories={categories} />
      <NewArrivals products={newest.items} />
      <ProductGridSection
        id="destacados"
        strong="Destacados."
        soft="Los kits que más os flipan."
        products={featuredGrid}
        href="/tienda?destacados=1"
        linkLabel="Ver destacados"
      />
      <HowItWorks />
      <BestSellers products={popular.items} />
      <Benefits />
      <BrandStory />
      <VerifiedReviews reviews={reviews} />
      <div className="h-16" />
      <NewsletterSection />
    </>
  )
}
