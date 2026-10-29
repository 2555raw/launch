import { NextResponse } from 'next/server'
import { getCatalog, isDemoMode } from '@/lib/catalog'
import { commerce } from '@/lib/config/commerce'
import { getI18n } from '@/lib/i18n/server'
import { getRecentPurchases } from '@/lib/orders/activity'
import { demoPurchases } from '@/lib/orders/demo-activity'

export type ActivityItem = {
  key: string
  kind: 'purchase' | 'highlight'
  href: string | null
  image: string | null
  title: string
  /** Línea de arriba en los avisos de la tienda (en las compras la pone el navegador). */
  eyebrow?: string
  /** Línea de abajo en los avisos de la tienda. */
  meta?: string
  province?: string | null
  paidAt?: string
}

/**
 * Lo que enseñan los avisos de abajo a la izquierda: primero las compras
 * de las últimas horas (anónimas; en modo demo, de ejemplo) y, detrás,
 * novedades de la tienda: el pack, regalar y la receta del kit destacado.
 */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' }
  if (!commerce.showRecentPurchases) return NextResponse.json({ items: [] }, { headers })
  const { t } = await getI18n()
  const catalog = getCatalog()
  const [purchases, newest, featured, categories] = await Promise.all([
    getRecentPurchases(),
    catalog.listProducts({ sort: 'newest', limit: 2 }),
    catalog.listProducts({ featured: true, sort: 'popular', limit: 1 }),
    catalog.listCategories(),
  ])
  const demo = isDemoMode()
  const { items: all } = purchases.length || demo ? await catalog.listProducts({ limit: 200 }) : { items: [] }
  const bySlug = new Map(all.map((p) => [p.slug, p]))
  // Prototipo sin base de datos: compras de ejemplo
  if (demo) {
    for (const p of demoPurchases(all.map((x) => x.slug))) {
      purchases.push({ key: p.key, slug: p.slug, productName: '', imageUrl: null, province: p.place, paidAt: p.paidAt })
    }
  }

  const items: ActivityItem[] = purchases.map((p) => {
    const product = p.slug ? bySlug.get(p.slug) : undefined
    return {
      key: p.key,
      kind: 'purchase',
      href: product ? `/producto/${product.slug}` : null,
      image: product?.image?.url ?? p.imageUrl,
      title: product?.name ?? p.productName,
      province: p.province,
      paidAt: p.paidAt,
    }
  })

  for (const p of newest.items) {
    items.push({
      key: `nuevo-${p.slug}`,
      kind: 'highlight',
      href: `/producto/${p.slug}`,
      image: p.image?.url ?? null,
      eyebrow: t({ es: 'Nuevo en la tienda', en: 'New in the shop' }),
      title: p.name,
      meta: p.subtitle ?? undefined,
    })
  }
  const level = categories.find((c) => c.level === 1)
  if (level && commerce.bundleMinKits > 0 && commerce.bundlePercent > 0) {
    items.push({
      key: 'pack',
      kind: 'highlight',
      href: `/categoria/${level.slug}`,
      image: level.imageUrl,
      eyebrow: t({ es: 'Packs por nivel', en: 'Level bundles' }),
      title: t({
        es: `${commerce.bundleMinKits} kits del mismo nivel, −${commerce.bundlePercent} %`,
        en: `${commerce.bundleMinKits} kits from one level, ${commerce.bundlePercent}% off`,
      }),
      meta: t({ es: 'Se descuenta solo en la cesta', en: 'Applied automatically in your bag' }),
    })
  }
  const box = categories.find((c) => c.level === null)
  items.push({
    key: 'regalo',
    kind: 'highlight',
    href: box ? `/categoria/${box.slug}` : '/tienda',
    image: box?.imageUrl ?? null,
    eyebrow: t({ es: '¿Es para regalar?', en: 'Is it a gift?' }),
    title: t({ es: 'Lo enviamos sin precios y con tu mensaje', en: 'We ship it with no prices and your message' }),
    meta: t({ es: 'Marca «Es un regalo» al pagar', en: 'Tick "It\'s a gift" at checkout' }),
  })
  const star = featured.items[0]
  if (star) {
    items.push({
      key: `receta-${star.slug}`,
      kind: 'highlight',
      href: `/receta/${star.slug}`,
      image: star.image?.url ?? null,
      eyebrow: t({ es: 'Receta paso a paso', en: 'Step-by-step recipe' }),
      title: star.name,
      meta: t({ es: 'Mírala antes de pedir el kit', en: 'Have a look before you order' }),
    })
  }
  return NextResponse.json({ items }, { headers })
}
