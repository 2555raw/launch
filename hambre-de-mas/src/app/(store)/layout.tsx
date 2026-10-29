import { CartDrawer } from '@/components/cart/cart-drawer'
import { HelpWidget } from '@/components/help/help-widget'
import { DemoBanner } from '@/components/layout/demo-banner'
import { Footer } from '@/components/layout/footer'
import { Header, type MenuData, type MenuKit } from '@/components/layout/header'
import { RecentPurchases } from '@/components/layout/recent-purchases'
import { ShippingBar } from '@/components/layout/shipping-bar'
import { getCatalog, isDemoMode } from '@/lib/catalog'
import { getLocale } from '@/lib/i18n/server'
import { formatPrice } from '@/lib/money'
import type { ProductSummary } from '@/lib/types'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const catalog = getCatalog()
  const locale = await getLocale()
  const [categories, newest, featured, box] = await Promise.all([
    catalog.listCategories(),
    catalog.listProducts({ sort: 'newest', limit: 4 }),
    catalog.listProducts({ featured: true, sort: 'popular', limit: 4 }),
    catalog.getProduct('caja-sorpresa'),
  ])
  const kit = (p: ProductSummary): MenuKit => ({
    slug: p.slug,
    name: p.name,
    image: p.image?.url ?? null,
    price: formatPrice(p.priceCents, locale),
    level: p.category?.level ?? null,
    levelName: p.category?.name ?? null,
  })
  const menu: MenuData = {
    newest: newest.items.map(kit),
    featured: featured.items.map(kit),
    box: box && {
      image: box.images[0]?.url ?? box.image?.url ?? null,
      subtitle: box.subtitle,
      options: box.variants.filter((v) => v.isActive).map((v) => ({ name: v.name, price: formatPrice(v.priceCents, locale) })),
    },
  }
  return (
    <>
      <ShippingBar />
      <Header categories={categories} menu={menu} />
      <main id="contenido">{children}</main>
      <Footer categories={categories} />
      {isDemoMode() && <DemoBanner />}
      <CartDrawer />
      <HelpWidget />
      <RecentPurchases />
    </>
  )
}
