import { ALLERGEN_CODES, type Allergen } from '@/lib/allergens'
import type { ProductFilter, SortKey } from '@/lib/types'
import { DEFAULT_PAGE_SIZE } from './repository'

/**
 * Traducción entre la URL (en castellano, legible y compartible) y el filtro
 * interno del catálogo. Ejemplo:
 *   /tienda?orden=precio-asc&dieta=vegano&tiempo=30&min=10&max=30
 */

export type SearchParams = Record<string, string | string[] | undefined>

export const sortOptions: { value: string; key: SortKey; label: string }[] = [
  { value: 'destacados', key: 'featured', label: 'Destacados' },
  { value: 'novedades', key: 'newest', label: 'Novedades' },
  { value: 'populares', key: 'popular', label: 'Más vendidos' },
  { value: 'precio-asc', key: 'price-asc', label: 'Precio: de menor a mayor' },
  { value: 'precio-desc', key: 'price-desc', label: 'Precio: de mayor a menor' },
]

export const dietOptions = [
  { value: 'vegano', label: 'Vegano' },
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'sin-gluten', label: 'Sin gluten' },
  { value: 'picante', label: 'Picante' },
]

export const timeOptions = [
  { value: '15', label: 'Hasta 15 min' },
  { value: '30', label: 'Hasta 30 min' },
  { value: '45', label: 'Hasta 45 min' },
]

export const difficultyOptions = [
  { value: '1', label: 'Fácil' },
  { value: '2', label: 'Media' },
  { value: '3', label: 'Reto' },
]

export const priceOptions = [
  { min: '', max: '15', label: 'Hasta 15 €' },
  { min: '15', max: '25', label: '15 € – 25 €' },
  { min: '25', max: '40', label: '25 € – 40 €' },
  { min: '40', max: '', label: 'Más de 40 €' },
]

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const list = (v: string | string[] | undefined) =>
  (one(v) ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
const euros = (v: string | string[] | undefined) => {
  const n = Number.parseFloat((one(v) ?? '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined
}

export function parseCatalogParams(params: SearchParams, base: ProductFilter = {}): ProductFilter & { page: number } {
  const page = Math.max(1, Number.parseInt(one(params.pagina) ?? '1', 10) || 1)
  const sort = sortOptions.find((o) => o.value === one(params.orden))?.key ?? base.sort ?? 'featured'
  const diets = list(params.dieta).filter((d) => dietOptions.some((o) => o.value === d))
  const excludeAllergens = list(params.sin).filter((a): a is Allergen => (ALLERGEN_CODES as string[]).includes(a))
  const difficulty = list(params.dificultad)
    .map(Number)
    .filter((n) => [1, 2, 3].includes(n))
  const minutes = Number.parseInt(one(params.tiempo) ?? '', 10)
  const q = one(params.q)?.trim().slice(0, 80)

  return {
    ...base,
    category: base.category ?? (one(params.categoria) || undefined),
    q: q || base.q,
    minPrice: euros(params.min),
    maxPrice: euros(params.max),
    tags: diets.length ? diets : undefined,
    excludeAllergens: excludeAllergens.length ? excludeAllergens : undefined,
    difficulty: difficulty.length ? difficulty : undefined,
    maxMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : undefined,
    inStock: one(params.stock) === '1' || undefined,
    featured: base.featured ?? (one(params.destacados) === '1' || undefined),
    sort,
    limit: DEFAULT_PAGE_SIZE,
    offset: (page - 1) * DEFAULT_PAGE_SIZE,
    page,
  }
}

/** Número de filtros activos (sin contar orden ni búsqueda). */
export function activeFilterCount(params: SearchParams) {
  return ['categoria', 'min', 'max', 'dieta', 'sin', 'tiempo', 'dificultad', 'stock', 'destacados'].filter((k) => one(params[k])).length
}
