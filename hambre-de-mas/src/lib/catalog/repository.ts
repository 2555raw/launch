import type { Category, ProductTranslation, Translations, ProductDetail, ProductFilter, ProductSummary, Review, VariantForQuote } from '@/lib/types'

export type ProductPage = { items: ProductSummary[]; total: number }

/** Acceso de solo lectura al catálogo público. */
export interface CatalogRepository {
  readonly source: 'supabase' | 'demo'
  listCategories(): Promise<Category[]>
  getCategory(slug: string): Promise<Category | null>
  listProducts(filter?: ProductFilter): Promise<ProductPage>
  getProduct(slug: string): Promise<ProductDetail | null>
  listRelated(product: ProductDetail, limit?: number): Promise<ProductSummary[]>
  listReviews(productId: string): Promise<Review[]>
  listRecentReviews(
    limit?: number,
  ): Promise<(Review & { productName: string; productSlug: string; translations?: Translations<ProductTranslation> })[]>
  getVariantsForQuote(variantIds: string[]): Promise<VariantForQuote[]>
  listSitemapEntries(): Promise<{ products: { slug: string; updatedAt: string }[]; categories: string[] }>
}

export const DEFAULT_PAGE_SIZE = 24
