import { CartDrawer } from '@/components/cart/cart-drawer'
import { HelpWidget } from '@/components/help/help-widget'
import { DemoBanner } from '@/components/layout/demo-banner'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { RecentPurchases } from '@/components/layout/recent-purchases'
import { getCatalog, isDemoMode } from '@/lib/catalog'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCatalog().listCategories()
  return (
    <>
      {isDemoMode() && <DemoBanner />}
      <Header categories={categories} />
      <main id="contenido">{children}</main>
      <Footer categories={categories} />
      <CartDrawer />
      <HelpWidget />
      <RecentPurchases />
    </>
  )
}
