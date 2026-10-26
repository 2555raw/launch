import type { Metadata } from 'next'
import { CartPageClient } from '@/components/cart/cart-page'

export const metadata: Metadata = { title: 'Cesta', robots: { index: false } }

export default function CartPage() {
  return <CartPageClient />
}
