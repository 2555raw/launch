import { NextResponse } from 'next/server'
import { getCatalog } from '@/lib/catalog'
import { commerce } from '@/lib/config/commerce'
import { getI18n } from '@/lib/i18n/server'
import { getRecentPurchases } from '@/lib/orders/activity'

/** Compras reales de las últimas horas, anónimas, para los avisos de la tienda. */
export async function GET() {
  if (!commerce.showRecentPurchases) return NextResponse.json({ purchases: [] })
  const { locale } = await getI18n()
  const purchases = await getRecentPurchases()
  if (purchases.length === 0) return NextResponse.json({ purchases: [] }, { headers: { 'Cache-Control': 'no-store' } })

  // Nombre e imagen del catálogo, en el idioma de la página
  const { items } = await getCatalog().listProducts({ limit: 200 })
  const bySlug = new Map(items.map((p) => [p.slug, p]))
  return NextResponse.json(
    {
      purchases: purchases.map((p) => {
        const product = p.slug ? bySlug.get(p.slug) : undefined
        return {
          key: p.key,
          href: product ? `/producto/${product.slug}` : null,
          name: product?.name ?? p.productName,
          image: product?.image?.url ?? p.imageUrl,
          province: p.province,
          paidAt: p.paidAt,
        }
      }),
      locale,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
