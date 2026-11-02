import { commerce } from '@/lib/config/commerce'
import { site } from '@/lib/config/site'
import { isPreorder, isPreorderOpen } from '@/lib/preorder'
import type { ProductDetail } from '@/lib/types'

/** URL absoluta a partir de una ruta del sitio (o la deja como está si ya lo es). */
export const absoluteUrl = (path: string) => (path.startsWith('http') ? path : `${site.url}${path.startsWith('/') ? '' : '/'}${path}`)

/** Migas de pan (schema.org BreadcrumbList): Google las muestra en el resultado en lugar de la URL. */
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: absoluteUrl(item.path) })),
  }
}

/** Lista de kits de una página de catálogo (schema.org ItemList). */
export function itemListLd(products: { slug: string; name: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, url: absoluteUrl(`/producto/${p.slug}`) })),
  }
}

/** Envío a Península y Baleares, como en /legal/envios (para fichas de producto y el feed de Google Shopping). */
const shippingDetails = {
  '@type': 'OfferShippingDetails',
  shippingRate: { '@type': 'MonetaryAmount', value: (commerce.shippingCents / 100).toFixed(2), currency: 'EUR' },
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'ES' },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
    transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
  },
}

const returnPolicy = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'ES',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: commerce.returnDays,
  returnMethod: 'https://schema.org/ReturnByMail',
}

/** Disponibilidad de una variante en schema.org (también sirve para las ediciones por encargo). */
export function availabilityOf(product: Pick<ProductDetail, 'attributes'>, stock: number, now = new Date()) {
  if (isPreorder(product.attributes, now)) return isPreorderOpen(product.attributes, now) && stock > 0 ? 'PreOrder' : 'OutOfStock'
  return stock > 0 ? 'InStock' : 'OutOfStock'
}

/**
 * Ficha de producto (schema.org Product) con una oferta por tamaño, envío y
 * devoluciones. La valoración media solo se incluye con opiniones reales: las
 * de ejemplo del modo demo no se marcan, Google lo considera engañoso.
 */
export function productLd(product: ProductDetail, rating: { average: number; count: number } | null) {
  const url = absoluteUrl(`/producto/${product.slug}`)
  const release = product.attributes.preorder?.releaseDate
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    description: product.subtitle ?? product.description,
    image: product.images.map((i) => absoluteUrl(i.url)),
    sku: product.variants[0]?.sku,
    brand: { '@type': 'Brand', name: site.name },
    category: product.category?.name,
    url,
    offers: product.variants
      .filter((v) => v.isActive)
      .map((v) => {
        const availability = availabilityOf(product, v.stock)
        return {
          '@type': 'Offer',
          sku: v.sku,
          name: `${product.name} · ${v.name}`,
          price: (v.priceCents / 100).toFixed(2),
          priceCurrency: 'EUR',
          availability: `https://schema.org/${availability}`,
          ...(availability === 'PreOrder' && release ? { availabilityStarts: `${release}T00:00:00+01:00` } : {}),
          url,
          itemCondition: 'https://schema.org/NewCondition',
          seller: { '@type': 'Organization', name: site.name },
          shippingDetails,
          hasMerchantReturnPolicy: returnPolicy,
        }
      }),
    ...(rating && rating.count > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating.average.toFixed(1), reviewCount: rating.count, bestRating: 5, worstRating: 1 } }
      : {}),
  }
}
