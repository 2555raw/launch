import 'server-only'
import { demoCategories, demoId, demoProducts, type DemoProduct } from '@/data/demo-catalog'
import type { Category, ProductDetail, ProductFilter, ProductSummary } from '@/lib/types'
import { normalizeSearch } from './mappers'
import { DEFAULT_PAGE_SIZE, type CatalogRepository } from './repository'

/**
 * Catálogo en memoria con los datos de demostración. Se usa cuando Supabase
 * no está configurado, para poder ver la tienda nada más clonarla. Es de
 * solo lectura: el stock no cambia y no se pueden hacer pedidos.
 */

const DAY = 86_400_000
const epoch = Date.UTC(2026, 9, 26)

const categories: Category[] = demoCategories.map((c) => ({
  id: demoId('category', c.slug),
  slug: c.slug,
  name: c.name,
  tagline: c.tagline,
  description: c.description,
  level: c.level,
  accent: c.accent,
  imageUrl: c.image,
  position: c.position,
}))

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

function toDetail(p: DemoProduct): ProductDetail {
  const category = categories.find((c) => c.slug === p.category) ?? null
  const variants = p.variants.map((v, i) => ({
    id: demoId('variant', v.sku),
    sku: v.sku,
    name: v.name,
    priceCents: v.price,
    compareAtPriceCents: v.compareAt ?? null,
    stock: v.stock,
    isActive: true,
    position: i,
  }))
  const cheapest = [...variants].sort((a, b) => a.priceCents - b.priceCents)[0]!
  const images = p.images.map((img, i) => ({
    id: demoId('image', `${p.slug}/${img.file}`),
    url: `/demo/products/${img.file}`,
    alt: img.alt,
    position: i,
  }))
  return {
    id: demoId('product', p.slug),
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle,
    description: p.description,
    priceCents: cheapest.priceCents,
    compareAtPriceCents: cheapest.compareAtPriceCents,
    badge: p.badge ?? null,
    isFeatured: Boolean(p.featured),
    isDemo: true,
    totalStock: variants.reduce((s, v) => s + v.stock, 0),
    salesCount: p.salesCount,
    publishedAt: new Date(epoch - p.publishedDaysAgo * DAY).toISOString(),
    attributes: p.attributes,
    tags: p.tags,
    includes: p.includes,
    specs: p.specs,
    taxRateBps: 1000,
    category: category ? { slug: category.slug, name: category.name, level: category.level, accent: category.accent } : null,
    categoryId: category?.id ?? null,
    images,
    image: images[0] ?? null,
    hoverImage: images[1] ?? null,
    variants,
    variantCount: variants.length,
    seoTitle: null,
    seoDescription: null,
  }
}

const products = demoProducts.map(toDetail)
const searchIndex = new Map(
  products.map((p) => [p.id, strip([p.name, p.subtitle, p.description, p.tags.join(' ')].join(' '))]),
)

function summary(p: ProductDetail): ProductSummary {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle,
    priceCents: p.priceCents,
    compareAtPriceCents: p.compareAtPriceCents,
    badge: p.badge,
    isFeatured: p.isFeatured,
    isDemo: p.isDemo,
    totalStock: p.totalStock,
    salesCount: p.salesCount,
    publishedAt: p.publishedAt,
    attributes: p.attributes,
    tags: p.tags,
    category: p.category,
    image: p.image,
    hoverImage: p.hoverImage,
    variantCount: p.variantCount,
  }
}

export function createDemoCatalog(): CatalogRepository {
  return {
    source: 'demo',

    async listCategories() {
      return categories
    },

    async getCategory(slug) {
      return categories.find((c) => c.slug === slug) ?? null
    },

    async listProducts(filter: ProductFilter = {}) {
      const words = normalizeSearch(filter.q ?? '')
      let items = products.filter((p) => {
        if (filter.category && p.category?.slug !== filter.category) return false
        if (words.length && !words.every((w) => searchIndex.get(p.id)!.includes(w))) return false
        if (filter.minPrice != null && p.priceCents < filter.minPrice) return false
        if (filter.maxPrice != null && p.priceCents > filter.maxPrice) return false
        if (filter.tags?.length && !filter.tags.every((t) => p.tags.includes(t))) return false
        if (filter.difficulty?.length && !filter.difficulty.includes(p.attributes.difficulty ?? 0)) return false
        if (filter.maxMinutes != null && (p.attributes.minutes ?? 0) > filter.maxMinutes) return false
        if (filter.inStock && p.totalStock <= 0) return false
        if (filter.featured && !p.isFeatured) return false
        return true
      })
      const sorters: Record<string, (a: ProductDetail, b: ProductDetail) => number> = {
        newest: (a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
        'price-asc': (a, b) => a.priceCents - b.priceCents,
        'price-desc': (a, b) => b.priceCents - a.priceCents,
        popular: (a, b) => b.salesCount - a.salesCount,
        featured: (a, b) => Number(b.isFeatured) - Number(a.isFeatured) || b.salesCount - a.salesCount,
      }
      items = [...items].sort(sorters[filter.sort ?? 'featured'] ?? sorters.featured)
      const offset = filter.offset ?? 0
      const limit = filter.limit ?? DEFAULT_PAGE_SIZE
      return { items: items.slice(offset, offset + limit).map(summary), total: items.length }
    },

    async getProduct(slug) {
      return products.find((p) => p.slug === slug) ?? null
    },

    async listRelated(product, limit = 4) {
      const same = products.filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
      const others = products.filter((p) => p.id !== product.id && p.categoryId !== product.categoryId)
      return [...same, ...others.sort((a, b) => b.salesCount - a.salesCount)].slice(0, limit).map(summary)
    },

    async listReviews() {
      return []
    },

    async listRecentReviews() {
      return []
    },

    async getVariantsForQuote(variantIds) {
      const wanted = new Set(variantIds)
      return products.flatMap((p) =>
        p.variants
          .filter((v) => wanted.has(v.id))
          .map((v) => ({
            variantId: v.id,
            sku: v.sku,
            variantName: v.name,
            priceCents: v.priceCents,
            compareAtPriceCents: v.compareAtPriceCents,
            stock: v.stock,
            isActive: v.isActive,
            productId: p.id,
            productSlug: p.slug,
            productName: p.name,
            productPublished: true,
            taxRateBps: p.taxRateBps,
            imageUrl: p.image?.url ?? null,
          })),
      )
    },

    async listSitemapEntries() {
      return {
        products: products.map((p) => ({ slug: p.slug, updatedAt: p.publishedAt ?? new Date(epoch).toISOString() })),
        categories: categories.map((c) => c.slug),
      }
    },
  }
}
