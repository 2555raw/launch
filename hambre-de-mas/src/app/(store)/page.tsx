import { Hero } from '@/components/home/hero'
import { Benefits, BestSellers, GymSection, HowItWorks, LevelsRow, NewArrivals, NewsletterSection, ProductGridSection, VerifiedReviews } from '@/components/home/sections'
import { JsonLd } from '@/components/seo/json-ld'
import { DEMO_RATING } from '@/data/demo-reviews'
import { getCatalog, isDemoMode } from '@/lib/catalog'
import { recipeQrSvg } from '@/lib/recipes/qr'
import { company, site } from '@/lib/config/site'
import { getI18n } from '@/lib/i18n/server'

// El catálogo se regenera como mucho cada minuto (ISR).
export const revalidate = 60

export default async function HomePage() {
  const catalog = getCatalog()
  const { t } = await getI18n()
  const [categories, newest, featured, popular, reviews, gym] = await Promise.all([
    catalog.listCategories(),
    catalog.listProducts({ newArrivals: true, sort: 'newest', limit: 6 }),
    catalog.listProducts({ featured: true, sort: 'popular', limit: 8 }),
    catalog.listProducts({ sort: 'popular', limit: 6 }),
    catalog.listRecentReviews(16),
    catalog.listProducts({ tags: ['alto-en-proteina'], sort: 'popular', limit: 24 }),
  ])

  const heroProduct = featured.items[0] ?? popular.items[0] ?? null
  const featuredGrid = featured.items.filter((p) => p.id !== heroProduct?.id).slice(0, 4)

  // Portada: el kit más pedido de cada nivel, sin el ramen, los wraps ni la pizza (ya salen en otras secciones)
  const heroSkip = new Set(['kit-ramen-casero', 'kit-wraps-crujientes', 'kit-pizza-napolitana'])
  const levels = categories.filter((c) => c.level).sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
  const tops = await Promise.all(levels.map((c) => catalog.listProducts({ category: c.slug, sort: 'popular', limit: 3 })))
  const heroPicks = tops.flatMap((page) => page.items.filter((p) => !heroSkip.has(p.slug)).slice(0, 1))
  const center = heroPicks.length >= 3 ? heroPicks[1] : heroPicks[0]
  const heroQr = center ? await recipeQrSvg(center.slug) : null
  const allReviews = await catalog.listRecentReviews(100)
  // En el prototipo (modo demo) la nota resume también las valoraciones sin texto
  const heroRating = isDemoMode()
    ? DEMO_RATING
    : allReviews.length
      ? { average: allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length, count: allReviews.length }
      : null

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
      <Hero picks={heroPicks} qrSvg={heroQr} recipeHref={center ? `/receta/${center.slug}` : undefined} rating={heroRating} />
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
      <GymSection products={gym.items} total={gym.total} />
      <HowItWorks />
      <BestSellers products={popular.items} />
      <Benefits />
      <VerifiedReviews reviews={reviews} />
      <div className="h-16" />
      <NewsletterSection />
    </>
  )
}
