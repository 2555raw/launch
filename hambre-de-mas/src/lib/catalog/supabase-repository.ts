import 'server-only'
import { isPreorder } from '@/lib/preorder'
import { createSupabasePublicClient } from '@/lib/supabase/public'
import type { ProductDetail, ProductFilter, Review } from '@/lib/types'
import {
  PRODUCT_DETAIL_SELECT,
  PRODUCT_SUMMARY_SELECT,
  mapCategory,
  mapProductDetail,
  mapProductSummary,
  normalizeSearch,
  translationsOf,
} from './mappers'
import { newArrivalsSince } from './params'
import { DEFAULT_PAGE_SIZE, type CatalogRepository } from './repository'

/* eslint-disable @typescript-eslint/no-explicit-any -- filas sin tipar de PostgREST */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`[catálogo] ${context}: ${error?.message ?? 'error desconocido'}`)
}

function mapReview(r: any): Review {
  return {
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    authorName: r.author_name,
    isVerified: r.is_verified,
    createdAt: r.created_at,
  }
}

export function createSupabaseCatalog(): CatalogRepository {
  const db = () => createSupabasePublicClient()

  return {
    source: 'supabase',

    async listCategories() {
      const { data, error } = await db().from('categories').select('*').eq('is_published', true).order('position')
      if (error) fail('categorías', error)
      return (data ?? []).map(mapCategory)
    },

    async getCategory(slug) {
      const { data, error } = await db().from('categories').select('*').eq('slug', slug).eq('is_published', true).maybeSingle()
      if (error) fail('categoría', error)
      return data ? mapCategory(data) : null
    },

    async listProducts(filter: ProductFilter = {}) {
      const limit = Math.min(filter.limit ?? DEFAULT_PAGE_SIZE, 100)
      const offset = Math.max(filter.offset ?? 0, 0)
      const select = filter.category
        ? PRODUCT_SUMMARY_SELECT.replace('category:categories(', 'category:categories!inner(')
        : PRODUCT_SUMMARY_SELECT
      let query = db().from('products').select(select, { count: 'exact' }).eq('status', 'published')

      if (filter.category) query = query.eq('category.slug', filter.category)
      for (const word of normalizeSearch(filter.q ?? '')) query = query.ilike('search_text', `%${word}%`)
      if (filter.minPrice != null) query = query.gte('price_cents', filter.minPrice)
      if (filter.maxPrice != null) query = query.lte('price_cents', filter.maxPrice)
      if (filter.tags?.length) query = query.contains('tags', filter.tags)
      if (filter.excludeAllergens?.length) {
        const list = `{${filter.excludeAllergens.join(',')}}`
        query = query.not('allergens', 'ov', list).not('allergen_traces', 'ov', list).not('recipe_allergens', 'ov', list)
      }
      if (filter.difficulty?.length) query = query.in('difficulty', filter.difficulty)
      if (filter.maxMinutes != null) query = query.lte('minutes', filter.maxMinutes)
      if (filter.inStock) query = query.gt('total_stock', 0)
      if (filter.featured) query = query.eq('is_featured', true)
      if (filter.newArrivals) query = query.gte('published_at', newArrivalsSince())

      switch (filter.sort ?? 'featured') {
        case 'newest':
          query = query.order('published_at', { ascending: false, nullsFirst: false })
          break
        case 'price-asc':
          query = query.order('price_cents', { ascending: true })
          break
        case 'price-desc':
          query = query.order('price_cents', { ascending: false })
          break
        case 'popular':
          query = query.order('sales_count', { ascending: false })
          break
        default:
          query = query.order('is_featured', { ascending: false }).order('sales_count', { ascending: false })
      }
      query = query.order('id').range(offset, offset + limit - 1)

      const { data, error, count } = await query
      if (error) fail('productos', error)
      return { items: (data ?? []).map(mapProductSummary), total: count ?? 0 }
    },

    async getProduct(slug) {
      const { data, error } = await db()
        .from('products')
        .select(PRODUCT_DETAIL_SELECT)
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle()
      if (error) fail('producto', error)
      return data ? mapProductDetail(data) : null
    },

    async listRelated(product: ProductDetail, limit = 4) {
      let query = db().from('products').select(PRODUCT_SUMMARY_SELECT).eq('status', 'published').neq('id', product.id)
      if (product.categoryId) query = query.eq('category_id', product.categoryId)
      const { data, error } = await query.order('sales_count', { ascending: false }).limit(limit)
      if (error) fail('relacionados', error)
      const items = (data ?? []).map(mapProductSummary)
      if (items.length >= limit) return items
      // Completa con los más vendidos de otras categorías.
      const { data: more } = await db()
        .from('products')
        .select(PRODUCT_SUMMARY_SELECT)
        .eq('status', 'published')
        .not('id', 'in', `(${[product.id, ...items.map((i) => i.id)].join(',')})`)
        .order('sales_count', { ascending: false })
        .limit(limit - items.length)
      return [...items, ...(more ?? []).map(mapProductSummary)]
    },

    async listReviews(productId) {
      const { data, error } = await db()
        .from('reviews')
        .select('id, rating, title, body, author_name, is_verified, created_at')
        .eq('product_id', productId)
        .eq('status', 'approved')
        .eq('is_verified', true)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) fail('opiniones', error)
      return (data ?? []).map(mapReview)
    },

    async listRecentReviews(limit = 3) {
      const { data, error } = await db()
        .from('reviews')
        .select('id, rating, title, body, author_name, is_verified, created_at, product:products(name, slug, translations)')
        .eq('status', 'approved')
        .eq('is_verified', true)
        .gte('rating', 4)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) fail('opiniones recientes', error)
      return (data ?? []).map((r: any) => ({ ...mapReview(r), productName: r.product?.name ?? '', productSlug: r.product?.slug ?? '', translations: translationsOf(r.product?.translations) }))
    },

    async getVariantsForQuote(variantIds) {
      const ids = [...new Set(variantIds)].filter((id) => UUID.test(id)).slice(0, 50)
      if (ids.length === 0) return []
      const { data, error } = await db()
        .from('product_variants')
        .select(
          'id, sku, name, price_cents, compare_at_price_cents, stock, is_active, product:products(id, slug, name, status, tax_rate_bps, attributes, translations, category:categories(level, name, translations), images:product_images(url, position))',
        )
        .in('id', ids)
      if (error) fail('variantes', error)
      return (data ?? []).map((v: any) => {
        const images = [...(v.product?.images ?? [])].sort((a: any, b: any) => a.position - b.position)
        return {
          variantId: v.id,
          sku: v.sku,
          variantName: v.name,
          priceCents: v.price_cents,
          compareAtPriceCents: v.compare_at_price_cents,
          stock: v.stock,
          isActive: v.is_active,
          productId: v.product?.id,
          productSlug: v.product?.slug,
          productName: v.product?.name,
          productPublished: v.product?.status === 'published',
          taxRateBps: v.product?.tax_rate_bps ?? 1000,
          imageUrl: images[0]?.url ?? null,
          preorderRelease: isPreorder(v.product?.attributes) ? v.product.attributes.preorder.releaseDate : null,
          categoryLevel: v.product?.category?.level ?? null,
          categoryName: v.product?.category?.name ?? null,
          categoryTranslations: translationsOf(v.product?.category?.translations),
          translations: translationsOf(v.product?.translations),
        }
      })
    },

    async listSitemapEntries() {
      const [{ data: products }, { data: categories }] = await Promise.all([
        db().from('products').select('slug, updated_at').eq('status', 'published'),
        db().from('categories').select('slug').eq('is_published', true),
      ])
      return {
        products: (products ?? []).map((p: any) => ({ slug: p.slug, updatedAt: p.updated_at })),
        categories: (categories ?? []).map((c: any) => c.slug),
      }
    },
  }
}
