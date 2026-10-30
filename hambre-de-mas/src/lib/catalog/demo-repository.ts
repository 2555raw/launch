import 'server-only'
import { demoCategories, demoId, demoProducts, type DemoProduct } from '@/data/demo-catalog'
import { demoCategoriesEn, demoProductsEn } from '@/data/demo-catalog-en'
import { demoReviews } from '@/data/demo-reviews'
import { sortAllergens } from '@/lib/allergens'
import { isPreorder } from '@/lib/preorder'
import type { Category, ProductDetail, ProductFilter, ProductSummary, Review } from '@/lib/types'
import { ingredientPhotos } from './ingredient-photos'
import { newArrivalsSince } from './params'
import { normalizeSearch, quickAddOf } from './mappers'
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
  translations: demoCategoriesEn[c.slug] ? { en: demoCategoriesEn[c.slug] } : {},
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
    allergens: sortAllergens(p.allergens.contains),
    allergenTraces: sortAllergens(p.allergens.traces),
    recipeAllergens: sortAllergens(p.allergens.recipe),
    recipe: p.recipe,
    includes: p.includes,
    includeImages: ingredientPhotos(p.includes),
    specs: p.specs,
    taxRateBps: 1000,
    category: category
      ? { slug: category.slug, name: category.name, level: category.level, accent: category.accent, translations: category.translations }
      : null,
    categoryId: category?.id ?? null,
    images,
    image: images[0] ?? null,
    hoverImage: images[1] ?? null,
    variants,
    variantCount: variants.length,
    quickAdd: isPreorder(p.attributes) ? null : quickAddOf(variants),
    seoTitle: null,
    seoDescription: null,
    translations: demoProductsEn[p.slug] ? { en: demoProductsEn[p.slug] } : {},
  }
}

const products = demoProducts.map(toDetail)
const searchIndex = new Map(
  products.map((p) => {
    const en = p.translations?.en
    return [p.id, strip([p.name, p.subtitle, p.description, p.tags.join(' '), en?.name, en?.subtitle, en?.description].join(' '))]
  }),
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
    allergens: p.allergens,
    category: p.category,
    image: p.image,
    hoverImage: p.hoverImage,
    variantCount: p.variantCount,
    quickAdd: isPreorder(p.attributes) ? null : quickAddOf(p.variants),
    translations: p.translations,
  }
}

/** Opiniones de ejemplo del prototipo, con fecha relativa a hoy (más recientes primero). */
function exampleReviews(): (Review & { productName: string; productSlug: string; translations?: ProductSummary['translations'] })[] {
  const now = new Date()
  return demoReviews
    .flatMap((r, i) => {
      const product = products.find((p) => p.slug === r.product)
      if (!product) return []
      const [h, m] = r.at.split(':').map(Number)
      const date = new Date(now)
      date.setDate(date.getDate() - r.daysAgo)
      date.setHours(h ?? 12, m ?? 0, 0, 0)
      return [
        {
          id: demoId('review', `${r.product}-${i}`),
          rating: r.rating,
          title: r.title,
          body: r.body,
          authorName: r.author,
          isVerified: true,
          createdAt: date.toISOString(),
          productName: product.name,
          productSlug: product.slug,
          translations: product.translations,
        },
      ]
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
      const since = newArrivalsSince()
      let items = products.filter((p) => {
        if (filter.category && p.category?.slug !== filter.category) return false
        if (words.length && !words.every((w) => searchIndex.get(p.id)!.includes(w))) return false
        if (filter.minPrice != null && p.priceCents < filter.minPrice) return false
        if (filter.maxPrice != null && p.priceCents > filter.maxPrice) return false
        if (filter.tags?.length && !filter.tags.every((t) => p.tags.includes(t))) return false
        if (filter.excludeAllergens?.some((a) => p.allergens.includes(a) || p.allergenTraces.includes(a) || p.recipeAllergens.includes(a))) return false
        if (filter.difficulty?.length && !filter.difficulty.includes(p.attributes.difficulty ?? 0)) return false
        if (filter.maxMinutes != null && (p.attributes.minutes ?? 0) > filter.maxMinutes) return false
        if (filter.inStock && p.totalStock <= 0) return false
        if (filter.featured && !p.isFeatured) return false
        if (filter.newArrivals && (p.publishedAt ?? '') < since) return false
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

    async listReviews(productId) {
      const slug = products.find((p) => p.id === productId)?.slug
      return exampleReviews().filter((r) => r.productSlug === slug)
    },

    async listRecentReviews(limit = 6) {
      return exampleReviews().slice(0, limit)
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
            preorderRelease: isPreorder(p.attributes) ? p.attributes.preorder!.releaseDate : null,
            categoryLevel: p.category?.level ?? null,
            categoryName: p.category?.name ?? null,
            categoryTranslations: p.category?.translations,
            translations: p.translations,
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
