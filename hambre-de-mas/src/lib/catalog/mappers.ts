import { sortAllergens } from '@/lib/allergens'
import type { Category, ProductDetail, ProductImage, ProductSummary, Recipe, Variant } from '@/lib/types'

/* eslint-disable @typescript-eslint/no-explicit-any -- filas sin tipar de PostgREST */

export const PRODUCT_SUMMARY_SELECT =
  'id, slug, name, subtitle, price_cents, compare_at_price_cents, badge, is_featured, is_demo, total_stock, sales_count, published_at, attributes, tags, allergens, category:categories(slug, name, level, accent), images:product_images(id, url, alt, position), variants:product_variants(id, is_active)'

export const PRODUCT_DETAIL_SELECT =
  'id, slug, name, subtitle, description, price_cents, compare_at_price_cents, badge, is_featured, is_demo, total_stock, sales_count, published_at, attributes, tags, allergens, allergen_traces, recipe_allergens, recipe, includes, specs, tax_rate_bps, seo_title, seo_description, category_id, category:categories(slug, name, level, accent), images:product_images(id, url, alt, position), variants:product_variants(id, sku, name, price_cents, compare_at_price_cents, stock, is_active, position)'

export function mapCategory(row: any): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline ?? null,
    description: row.description ?? null,
    level: row.level ?? null,
    accent: row.accent ?? 'chef',
    imageUrl: row.image_url ?? null,
    position: row.position ?? 0,
  }
}

export function mapImages(rows: any[] | null | undefined): ProductImage[] {
  return (rows ?? [])
    .map((r) => ({ id: r.id, url: r.url, alt: r.alt ?? '', position: r.position ?? 0 }))
    .sort((a, b) => a.position - b.position)
}

export function mapVariants(rows: any[] | null | undefined): Variant[] {
  return (rows ?? [])
    .map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      priceCents: r.price_cents,
      compareAtPriceCents: r.compare_at_price_cents ?? null,
      stock: r.stock,
      isActive: r.is_active,
      position: r.position ?? 0,
    }))
    .sort((a, b) => a.position - b.position || a.priceCents - b.priceCents)
}

export function mapProductSummary(row: any): ProductSummary {
  const images = mapImages(row.images)
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle ?? null,
    priceCents: row.price_cents,
    compareAtPriceCents: row.compare_at_price_cents ?? null,
    badge: row.badge ?? null,
    isFeatured: Boolean(row.is_featured),
    isDemo: Boolean(row.is_demo),
    totalStock: row.total_stock ?? 0,
    salesCount: row.sales_count ?? 0,
    publishedAt: row.published_at ?? null,
    attributes: row.attributes ?? {},
    tags: row.tags ?? [],
    allergens: sortAllergens(row.allergens),
    category: row.category
      ? { slug: row.category.slug, name: row.category.name, level: row.category.level, accent: row.category.accent }
      : null,
    image: images[0] ?? null,
    hoverImage: images[1] ?? null,
    variantCount: (row.variants ?? []).filter((v: any) => v.is_active !== false).length,
  }
}

export function mapProductDetail(row: any): ProductDetail {
  const summary = mapProductSummary(row)
  return {
    ...summary,
    description: row.description ?? '',
    includes: row.includes ?? [],
    specs: Array.isArray(row.specs) ? row.specs : [],
    allergenTraces: sortAllergens(row.allergen_traces),
    recipeAllergens: sortAllergens(row.recipe_allergens),
    recipe: mapRecipe(row.recipe),
    taxRateBps: row.tax_rate_bps,
    images: mapImages(row.images),
    variants: mapVariants(row.variants).filter((v) => v.isActive),
    seoTitle: row.seo_title ?? null,
    seoDescription: row.seo_description ?? null,
    categoryId: row.category_id ?? null,
  }
}

export function mapRecipe(raw: any): Recipe {
  const list = (v: any) => (Array.isArray(v) ? v : [])
  return {
    youAdd: list(raw?.youAdd).map(String),
    steps: list(raw?.steps)
      .filter((s: any) => s && s.title && s.text)
      .map((s: any) => ({ title: String(s.title), text: String(s.text) })),
    tips: list(raw?.tips).map(String),
  }
}

/** Normaliza una búsqueda igual que la columna search_text: minúsculas y sin tildes. */
export function normalizeSearch(input: string) {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 6)
}
