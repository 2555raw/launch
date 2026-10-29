import type { Locale } from '@/lib/i18n/config'
import type { Category, ProductDetail, ProductSummary, ProductTranslation, Recipe, VariantForQuote } from '@/lib/types'

/**
 * Aplica las traducciones guardadas en `translations` al idioma pedido. Lo que
 * no esté traducido se queda en español. El resultado ya no lleva el campo
 * `translations`, para no mandar todos los idiomas al navegador.
 */

type WithTranslations = { translations?: unknown }

function strip<T extends WithTranslations>(value: T): Omit<T, 'translations'> {
  const rest = { ...value }
  delete rest.translations
  return rest
}

const text = (value: unknown, fallback: string) => (typeof value === 'string' && value.trim() ? value : fallback)
const list = (value: unknown, fallback: string[]) =>
  Array.isArray(value) && value.length && value.every((v) => typeof v === 'string') ? (value as string[]) : fallback

function pick<T>(translations: unknown, locale: Locale): Partial<T> {
  if (locale === 'es' || !translations || typeof translations !== 'object') return {}
  const entry = (translations as Record<string, unknown>)[locale]
  return entry && typeof entry === 'object' ? (entry as Partial<T>) : {}
}

export function localizeCategory<T extends Pick<Category, 'name'> & Partial<Pick<Category, 'tagline' | 'description'>> & WithTranslations>(
  category: T,
  locale: Locale,
) {
  const tr = pick<{ name: string; tagline: string; description: string }>(category.translations, locale)
  const out = { ...strip(category), name: text(tr.name, category.name) } as Omit<T, 'translations'>
  if ('tagline' in category) Object.assign(out, { tagline: category.tagline == null ? null : text(tr.tagline, category.tagline) })
  if ('description' in category) Object.assign(out, { description: category.description == null ? null : text(tr.description, category.description) })
  return out
}

function localizeRecipe(recipe: Recipe, tr: Partial<Recipe> | undefined): Recipe {
  if (!tr) return recipe
  const steps =
    Array.isArray(tr.steps) && tr.steps.length === recipe.steps.length && tr.steps.every((s) => s?.title && s?.text) ? tr.steps : recipe.steps
  return { youAdd: list(tr.youAdd, recipe.youAdd), steps, tips: list(tr.tips, recipe.tips) }
}

export function localizeProductSummary(product: ProductSummary, locale: Locale): ProductSummary {
  const tr = pick<ProductTranslation>(product.translations, locale)
  const alts = tr.imageAlts ?? []
  const image = (img: ProductSummary['image'], index: number) => (img ? { ...img, alt: text(alts[index], img.alt) } : img)
  return {
    ...strip(product),
    name: text(tr.name, product.name),
    subtitle: product.subtitle == null ? null : text(tr.subtitle, product.subtitle),
    badge: product.badge == null ? null : text(tr.badge, product.badge),
    category: product.category ? localizeCategory(product.category, locale) : null,
    image: image(product.image, 0),
    hoverImage: image(product.hoverImage, 1),
    quickAdd: product.quickAdd ? { ...product.quickAdd, name: text(tr.variants?.[product.quickAdd.sku], product.quickAdd.name) } : null,
  }
}

export function localizeProductDetail(product: ProductDetail, locale: Locale): ProductDetail {
  const tr = pick<ProductTranslation>(product.translations, locale)
  const alts = tr.imageAlts ?? []
  const specs =
    Array.isArray(tr.specs) && tr.specs.length && tr.specs.every((s) => s?.label && s?.value) ? tr.specs : product.specs
  return {
    ...strip(product),
    ...localizeProductSummary(product, locale),
    description: text(tr.description, product.description),
    includes: list(tr.includes, product.includes),
    specs,
    recipe: localizeRecipe(product.recipe, tr.recipe),
    images: product.images.map((img, i) => ({ ...img, alt: text(alts[i], img.alt) })),
    variants: product.variants.map((v) => ({ ...v, name: text(tr.variants?.[v.sku], v.name) })),
    seoTitle: product.seoTitle == null ? null : text(tr.seoTitle, product.seoTitle),
    seoDescription: product.seoDescription == null ? null : text(tr.seoDescription, product.seoDescription),
  }
}

export function localizeVariantForQuote(variant: VariantForQuote, locale: Locale): VariantForQuote {
  const tr = pick<ProductTranslation>(variant.translations, locale)
  return {
    ...strip(variant),
    productName: text(tr.name, variant.productName),
    variantName: text(tr.variants?.[variant.sku], variant.variantName),
    categoryName: variant.categoryName == null ? null : text(pick<{ name: string }>(variant.categoryTranslations, locale).name, variant.categoryName),
  }
}

/** Solo el nombre del producto (para listados que no traen la ficha entera). */
export function localizeProductName(name: string, translations: unknown, locale: Locale) {
  return text(pick<ProductTranslation>(translations, locale).name, name)
}
