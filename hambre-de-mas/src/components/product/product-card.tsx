'use client'

import Link from 'next/link'
import { ClockIcon } from '@/components/ui/icons'
import { AllergenStrip } from './allergen-icons'
import { LevelChip } from '@/components/ui/level-chip'
import { Price } from '@/components/ui/price'
import { ProductImage } from '@/components/ui/product-image'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'
import type { ProductSummary } from '@/lib/types'

/** Tarjeta minimalista: imagen protagonista, nombre, precio. Al pasar el ratón muestra la segunda foto. */
export function ProductCard({
  product,
  priority = false,
  className,
  sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 90vw',
}: {
  product: ProductSummary
  priority?: boolean
  className?: string
  sizes?: string
}) {
  const { t } = useI18n()
  const soldOut = product.totalStock <= 0
  return (
    <Link
      href={`/producto/${product.slug}`}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-[var(--radius-tile)] bg-white shadow-card ring-1 ring-black/[0.03] transition-[box-shadow,transform] duration-500 ease-[var(--ease-apple)] hover:-translate-y-1 hover:shadow-card-hover',
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-mist">
        {product.image && (
          <ProductImage
            src={product.image.url}
            alt={product.image.alt || product.name}
            fill
            sizes={sizes}
            priority={priority}
            className={cn(
              'object-cover transition-[opacity,transform] duration-700 ease-[var(--ease-apple)] group-hover:scale-[1.03]',
              product.hoverImage && 'group-hover:opacity-0',
              soldOut && 'opacity-60 grayscale-[30%]',
            )}
          />
        )}
        {product.hoverImage && (
          <ProductImage
            src={product.hoverImage.url}
            alt=""
            fill
            sizes={sizes}
            className="scale-[1.03] object-cover opacity-0 transition-opacity duration-700 ease-[var(--ease-apple)] group-hover:opacity-100"
          />
        )}
        <div className="absolute top-4 left-4 flex flex-wrap gap-2">
          {product.category && <LevelChip level={product.category.level} accent={product.category.accent} name={product.category.name} overlay />}
        </div>
        {soldOut && (
          <span className="absolute right-4 bottom-4 rounded-full bg-ink/80 px-3 py-1 text-xs font-medium text-white backdrop-blur">{t({ es: 'Agotado', en: 'Sold out' })}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-5 sm:p-6">
        {product.badge && <p className="text-[12px] font-semibold text-teja">{product.badge}</p>}
        <h3 className="font-display text-[19px] leading-snug font-bold">{product.name}</h3>
        {product.subtitle && <p className="line-clamp-2 text-sm text-ash-ink">{product.subtitle}</p>}
        {/* Sin alérgenos declarados no se pinta (p. ej. la caja sorpresa, que cambia cada mes):
            todo en gris parecería «sin alérgenos». */}
        {product.allergens.length > 0 && (
          <div className="mt-3">
            <AllergenStrip codes={product.allergens} />
          </div>
        )}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <Price cents={product.priceCents} compareAt={product.compareAtPriceCents} from={product.variantCount > 1} />
          {product.attributes.minutes ? (
            <span className="flex items-center gap-1 text-xs text-ash-ink">
              <ClockIcon size={14} /> {product.attributes.minutes} min
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
