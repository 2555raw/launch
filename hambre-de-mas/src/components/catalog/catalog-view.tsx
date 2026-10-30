import Link from 'next/link'
import { Suspense } from 'react'
import { ProductCard } from '@/components/product/product-card'
import { buttonClass } from '@/components/ui/button'
import { getCatalog } from '@/lib/catalog'
import { activeFilterCount, parseCatalogParams, type SearchParams } from '@/lib/catalog/params'
import { DEFAULT_PAGE_SIZE } from '@/lib/catalog/repository'
import { getI18n } from '@/lib/i18n/server'
import type { ProductFilter } from '@/lib/types'
import { FilterPanel, MobileFilters, SortSelect } from './filters'

/** Rejilla de productos con filtros, orden y paginación (todo por URL). */
export async function CatalogView({
  params,
  base = {},
  basePath,
  resetHref,
  lockCategory = false,
  emptyMessage,
}: {
  params: SearchParams
  base?: ProductFilter
  basePath: string
  /** Enlace de "Quitar filtros" (por defecto, basePath). */
  resetHref?: string
  lockCategory?: boolean
  emptyMessage?: string
}) {
  const catalog = getCatalog()
  const { t } = await getI18n()
  const filter = parseCatalogParams(params, base)
  const [{ items, total }, categories] = await Promise.all([catalog.listProducts(filter), catalog.listCategories()])
  const pages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE))
  const filters = activeFilterCount(params)
  const categoryOptions = categories.map((c) => ({ slug: c.slug, name: c.name, tagline: c.tagline }))

  const pageHref = (page: number) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (typeof v === 'string' && k !== 'pagina') qs.set(k, v)
    if (page > 1) qs.set('pagina', String(page))
    const s = qs.toString()
    return s ? `${basePath}?${s}` : basePath
  }

  return (
    <div className="container-page grid gap-10 pb-24 lg:grid-cols-[230px_1fr]">
      <aside className="hidden lg:block" aria-label={t({ es: 'Filtros', en: 'Filters' })}>
        {/* Más alto que la pantalla: se desplaza solo, con la rueda del ratón encima (sin barra visible) */}
        <div className="filters-scroll sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain pb-6">
          <Suspense>
            <FilterPanel categories={categoryOptions} lockCategory={lockCategory} />
          </Suspense>
        </div>
      </aside>

      <section aria-label={t({ es: 'Productos', en: 'Products' })}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <p className="text-sm text-ash-ink" aria-live="polite">
            {total} {total === 1 ? 'kit' : 'kits'}
          </p>
          <div className="flex items-center gap-2">
            <Suspense>
              <MobileFilters categories={categoryOptions} count={filters} lockCategory={lockCategory} />
              <SortSelect />
            </Suspense>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-[28px] bg-mist px-6 py-20 text-center">
            <p className="font-display text-2xl font-bold">{t({ es: 'Nada por aquí', en: 'Nothing here' })}</p>
            <p className="mt-2 text-ash-ink">{emptyMessage ?? t({ es: 'No hay kits que coincidan con estos filtros.', en: 'No kits match these filters.' })}</p>
            <Link href={resetHref ?? basePath} className={buttonClass('secondary', 'md', 'mt-6')}>
              {t({ es: 'Quitar filtros', en: 'Clear filters' })}
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((p, i) => (
              <li key={p.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <ProductCard product={p} morph priority={i < 3} sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 92vw" />
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label={t({ es: 'Paginación', en: 'Pagination' })} className="mt-12 flex items-center justify-center gap-2">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={pageHref(p)}
                aria-current={p === filter.page ? 'page' : undefined}
                className={buttonClass(p === filter.page ? 'dark' : 'secondary', 'sm', 'w-10 px-0')}
              >
                {p}
              </Link>
            ))}
          </nav>
        )}
      </section>
    </div>
  )
}

export function PageIntro({ eyebrow, title, soft, children }: { eyebrow?: string; title: string; soft?: string; children?: React.ReactNode }) {
  return (
    <header className="container-page pt-10 pb-10 sm:pt-14">
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h1 className="max-w-4xl font-display text-[40px] leading-[1.04] font-extrabold tracking-tight sm:text-6xl">
        {title} {soft && <span className="text-chef">{soft}</span>}
      </h1>
      {children}
    </header>
  )
}
