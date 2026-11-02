import { getBaseCatalog } from '@/lib/catalog'
import { commerce } from '@/lib/config/commerce'
import { site } from '@/lib/config/site'
import { preorderClosesAt } from '@/lib/preorder'
import { absoluteUrl, availabilityOf } from '@/lib/seo'

/**
 * Feed de productos para Google Merchant Center (anuncios de Google Shopping y
 * fichas gratuitas). Una entrada por tamaño de cada kit, agrupadas por kit.
 * En Merchant Center: Productos › Fuentes de datos › Añadir › «Recuperación
 * programada» con la URL ${site.url}/feed/google-shopping.xml.
 */
export const revalidate = 3600

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const money = (cents: number) => `${(cents / 100).toFixed(2)} EUR`
/** Categoría de Google: Alimentación, bebida y tabaco › Comida (422). */
const GOOGLE_CATEGORY = '422'
const AVAILABILITY = { InStock: 'in_stock', OutOfStock: 'out_of_stock', PreOrder: 'preorder' } as const

export async function GET() {
  const catalog = getBaseCatalog()
  const { products } = await catalog.listSitemapEntries()
  const details = (await Promise.all(products.map((p) => catalog.getProduct(p.slug)))).filter((p) => p !== null)

  const items = details.flatMap((product) =>
    product.variants
      .filter((v) => v.isActive)
      .map((v) => {
        const availability = availabilityOf(product, v.stock)
        const onSale = v.compareAtPriceCents != null && v.compareAtPriceCents > v.priceCents
        const preorder = product.attributes.preorder
        const fields: [string, string | null | undefined][] = [
          ['g:id', v.id],
          ['g:item_group_id', product.id],
          ['g:title', `${product.name} · ${v.name}`],
          ['g:description', product.description || product.subtitle],
          ['g:link', absoluteUrl(`/producto/${product.slug}`)],
          ['g:image_link', product.images[0] ? absoluteUrl(product.images[0].url) : null],
          ['g:availability', AVAILABILITY[availability as keyof typeof AVAILABILITY]],
          ['g:availability_date', availability === 'PreOrder' && preorder ? `${preorder.releaseDate}T00:00:00+01:00` : null],
          ['g:expiration_date', availability === 'PreOrder' && preorder ? preorderClosesAt(preorder).toISOString() : null],
          ['g:price', money(onSale ? v.compareAtPriceCents! : v.priceCents)],
          ['g:sale_price', onSale ? money(v.priceCents) : null],
          ['g:brand', site.name],
          ['g:condition', 'new'],
          ['g:identifier_exists', 'no'],
          ['g:google_product_category', GOOGLE_CATEGORY],
          ['g:product_type', `Kits de cocina > ${product.category?.name ?? 'Kits'}`],
          ['g:age_group', 'teen'],
          ['g:custom_label_0', product.category?.slug],
          ['g:custom_label_1', product.tags.includes('alto-en-proteina') ? 'alto-en-proteina' : null],
          ['g:custom_label_2', preorder ? 'edicion-especial' : null],
        ]
        const extraImages = product.images.slice(1, 10).map((img) => `      <g:additional_image_link>${esc(absoluteUrl(img.url))}</g:additional_image_link>`)
        // Desde el pedido mínimo para envío gratis, un solo kit ya no paga envío
        const shippingCents = v.priceCents >= commerce.freeShippingThresholdCents ? 0 : commerce.shippingCents
        const shipping = `      <g:shipping><g:country>ES</g:country><g:price>${money(shippingCents)}</g:price></g:shipping>`
        return [
          '    <item>',
          ...fields.filter(([, value]) => value).map(([key, value]) => `      <${key}>${esc(String(value))}</${key}>`),
          ...extraImages,
          shipping,
          '    </item>',
        ].join('\n')
      }),
  )

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '  <channel>',
    `    <title>${esc(site.name)}</title>`,
    `    <link>${esc(site.url)}</link>`,
    `    <description>${esc(site.description.es)}</description>`,
    ...items,
    '  </channel>',
    '</rss>',
  ].join('\n')

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
