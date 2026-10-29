import { Hero } from '@/components/home/hero'
import {
  Benefits,
  BestSellers,
  HowItWorks,
  LevelsRow,
  NewArrivals,
  NewsletterSection,
  ProductGridSection,
  PurchaseMapSection,
  StoreIntro,
  VerifiedReviews,
} from '@/components/home/sections'
import { JsonLd } from '@/components/seo/json-ld'
import { getCatalog } from '@/lib/catalog'
import { recipeQrSvg } from '@/lib/recipes/qr'
import { company, site } from '@/lib/config/site'
import { getI18n } from '@/lib/i18n/server'
import { getPurchaseMap } from '@/lib/orders/activity'

// El catálogo se regenera como mucho cada minuto (ISR).
export const revalidate = 60

export default async function HomePage() {
  const catalog = getCatalog()
  const { t } = await getI18n()
  const [categories, newest, featured, popular, reviews, purchaseMap] = await Promise.all([
    catalog.listCategories(),
    catalog.listProducts({ sort: 'newest', limit: 6 }),
    catalog.listProducts({ featured: true, sort: 'popular', limit: 8 }),
    catalog.listProducts({ sort: 'popular', limit: 6 }),
    catalog.listRecentReviews(3),
    getPurchaseMap(),
  ])

  const heroProduct = featured.items[0] ?? popular.items[0] ?? null
  const featuredGrid = featured.items.filter((p) => p.id !== heroProduct?.id).slice(0, 4)
  const heroDetail = heroProduct ? await catalog.getProduct(heroProduct.slug) : null
  const heroQr = heroDetail?.recipe.steps.length ? await recipeQrSvg(heroDetail.slug) : null

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: company.legalName ?? site.name,
          url: site.url,
          logo: `${site.url}/brand/logo-720.png`,
          sameAs: [site.social.instagram, site.social.tiktok, site.social.x],
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
      <Hero
        product={heroProduct}
        includes={heroDetail?.includes.filter((i) => !/tarjeta|recipe card/i.test(i))}
        qrSvg={heroQr}
        recipeHref={heroDetail ? `/receta/${heroDetail.slug}` : undefined}
      />
      <StoreIntro />
      <LevelsRow categories={categories} />
      <NewArrivals products={newest.items} />
      <ProductGridSection
        id="destacados"
        strong={t({ es: 'Destacados.', en: 'Featured.' })}
        soft={t({ es: 'Los kits que más os flipan.', en: 'The kits you love most.' })}
        products={featuredGrid}
        href="/tienda?destacados=1"
        linkLabel={t({ es: 'Ver destacados', en: 'See featured' })}
      />
      <HowItWorks />
      <BestSellers products={popular.items} />
      <Benefits />
      <PurchaseMapSection points={purchaseMap} />
      <VerifiedReviews reviews={reviews} />
      <div className="h-16" />
      <NewsletterSection />
    </>
  )
}
