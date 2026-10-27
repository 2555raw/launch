import type { Metadata } from 'next'
import { CartPageClient } from '@/components/cart/cart-page'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t({ es: 'Cesta', en: 'Bag' }), robots: { index: false } }
}

export default function CartPage() {
  return <CartPageClient />
}
