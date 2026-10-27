import 'server-only'
import { cache } from 'react'
import { isSupabaseConfigured } from '@/lib/env'
import { getLocale } from '@/lib/i18n/server'
import { createDemoCatalog } from './demo-repository'
import { localizeCategory, localizeProductDetail, localizeProductName, localizeProductSummary, localizeVariantForQuote } from './localize'
import type { CatalogRepository } from './repository'
import { createSupabaseCatalog } from './supabase-repository'

/**
 * Devuelve el catálogo de Supabase si está configurado; si no, el de
 * demostración en memoria (solo lectura). Los textos llegan ya en el idioma
 * de la petición.
 */
export const getCatalog = cache((): CatalogRepository => {
  const base = isSupabaseConfigured() ? createSupabaseCatalog() : createDemoCatalog()
  return localized(base)
})

function localized(base: CatalogRepository): CatalogRepository {
  return {
    source: base.source,
    async listCategories() {
      const [items, locale] = await Promise.all([base.listCategories(), getLocale()])
      return items.map((c) => localizeCategory(c, locale))
    },
    async getCategory(slug) {
      const [category, locale] = await Promise.all([base.getCategory(slug), getLocale()])
      return category && localizeCategory(category, locale)
    },
    async listProducts(filter) {
      const [page, locale] = await Promise.all([base.listProducts(filter), getLocale()])
      return { ...page, items: page.items.map((p) => localizeProductSummary(p, locale)) }
    },
    async getProduct(slug) {
      const [product, locale] = await Promise.all([base.getProduct(slug), getLocale()])
      return product && localizeProductDetail(product, locale)
    },
    async listRelated(product, limit) {
      const [items, locale] = await Promise.all([base.listRelated(product, limit), getLocale()])
      return items.map((p) => localizeProductSummary(p, locale))
    },
    listReviews: (productId) => base.listReviews(productId),
    async listRecentReviews(limit) {
      const [items, locale] = await Promise.all([base.listRecentReviews(limit), getLocale()])
      return items.map(({ translations, ...review }) => ({
        ...review,
        productName: localizeProductName(review.productName, translations, locale),
      }))
    },
    async getVariantsForQuote(variantIds) {
      const [items, locale] = await Promise.all([base.getVariantsForQuote(variantIds), getLocale()])
      return items.map((v) => localizeVariantForQuote(v, locale))
    },
    // Solo slugs: se usa al generar páginas estáticas, fuera de una petición.
    listSitemapEntries: () => base.listSitemapEntries(),
  }
}

export const isDemoMode = () => !isSupabaseConfigured()

export type { CatalogRepository, ProductPage } from './repository'
