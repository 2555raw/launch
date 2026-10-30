'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { useCart } from '@/components/cart/cart-context'
import { ArrowRightIcon, CheckIcon, ClockIcon, PlusIcon } from '@/components/ui/icons'
import { AllergenStrip } from './allergen-icons'
import { LevelChip } from '@/components/ui/level-chip'
import { Price } from '@/components/ui/price'
import { ProductImage } from '@/components/ui/product-image'
import { cn } from '@/lib/cn'
import { commerce } from '@/lib/config/commerce'
import { useI18n } from '@/lib/i18n/client'
import { flyToCart } from '@/lib/fly-to-cart'
import { formatPrice } from '@/lib/money'
import { dayLabel, fullDaysUntil, isPreorder, isPreorderOpen, preorderClosesAt } from '@/lib/preorder'
import type { ProductSummary } from '@/lib/types'
import { ProductBadge } from './product-badge'

/**
 * Tarjeta minimalista: imagen protagonista, nombre, precio. Al pasar el ratón
 * se levanta, muestra la segunda foto y un botón para añadir sin entrar.
 */
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
  const { t, locale } = useI18n()
  const soldOut = product.totalStock <= 0
  const preorder = isPreorder(product.attributes) ? product.attributes.preorder! : null
  const preorderOpen = isPreorderOpen(product.attributes)
  // Días completos que quedan, como la cuenta atrás de la ficha (0 = último día)
  const daysLeft = preorder ? fullDaysUntil(preorderClosesAt(preorder)) : 0
  const photo = (
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
      {/* Nivel a la izquierda y etiqueta a la derecha, a la misma altura. En las ediciones
        por encargo solo va su etiqueta: las dos juntas no caben en una tarjeta estrecha. */}
      <div className="absolute inset-x-4 top-4 flex flex-wrap items-center justify-between gap-2">
        {product.category && !(preorder && product.badge) && (
          <LevelChip level={product.category.level} accent={product.category.accent} name={product.category.name} overlay className="h-6 shadow-sm" />
        )}
        {product.badge && <ProductBadge badge={product.badge} className="h-6 py-0" />}
      </div>
      {preorder && !soldOut && (
        <>
          {/* Edición por encargo: cuenta atrás sobre la foto */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-hoja-deep via-hoja-deep/45 to-transparent" />
          <div className="absolute inset-x-5 bottom-4 flex items-end justify-between gap-3 text-white">
            {preorderOpen ? (
              // Cuenta atrás hasta que se cierran los encargos
              daysLeft > 0 ? (
                <p className="flex items-baseline gap-2 whitespace-nowrap" suppressHydrationWarning>
                  <span className="font-display text-[44px] leading-none font-bold tabular-nums">{daysLeft}</span>
                  <span className="text-sm leading-tight font-semibold text-white/90">
                    {daysLeft === 1 ? t({ es: 'día para', en: 'day left' }) : t({ es: 'días para', en: 'days left' })}
                    <br />
                    {t({ es: 'encargarla', en: 'to pre-order' })}
                  </span>
                </p>
              ) : (
                <p className="text-[15px] font-semibold">{t({ es: 'Último día para encargarla', en: 'Last day to pre-order' })}</p>
              )
            ) : (
              <p className="text-[15px] font-semibold">{t({ es: 'Encargos cerrados', en: 'Pre-orders closed' })}</p>
            )}
          </div>
        </>
      )}
      {soldOut && (
        <span className="absolute right-4 bottom-4 rounded-full bg-ink/80 px-3 py-1 text-xs font-medium text-white backdrop-blur">
          {t({ es: 'Agotado', en: 'Sold out' })}
        </span>
      )}
    </div>
  )
  return (
    <div className={cn('group relative h-full transition-transform duration-500 ease-[var(--ease-apple)] hover:-translate-y-1.5', className)}>
      <Link
        href={`/producto/${product.slug}`}
        className={cn(
          'flex h-full flex-col overflow-hidden rounded-[var(--radius-tile)] shadow-card ring-1 transition-shadow duration-500 ease-[var(--ease-apple)] group-hover:shadow-card-hover',
          preorder ? 'bg-hoja-deep text-white ring-white/10' : 'bg-white ring-black/[0.03]',
        )}
      >
        {photo}
        {preorder ? (
          <div className="flex flex-1 flex-col gap-1 p-5 sm:p-6">
            <p className="text-[11px] font-bold tracking-[0.14em] text-almendra uppercase">
              {t({ es: `Edición limitada · sale el ${dayLabel(preorder.releaseDate, locale, 'short')}`, en: `Limited edition · out ${dayLabel(preorder.releaseDate, locale, 'short')}` })}
            </p>
            <h3 className="font-display text-[22px] leading-snug font-bold">{product.name}</h3>
            {product.subtitle && <p className="line-clamp-2 text-sm text-white/70">{product.subtitle}</p>}
            {product.allergens.length > 0 && (
              <div className="mt-3 w-fit rounded-xl bg-white/95 p-1.5">
                <AllergenStrip codes={product.allergens} />
              </div>
            )}
            <div className="mt-auto flex items-center justify-between gap-3 pt-5">
              <p className="text-[15px] font-semibold tabular-nums">
                {product.variantCount > 1 && <span className="font-normal text-white/60">{t({ es: 'Desde ', en: 'From ' })}</span>}
                {formatPrice(product.priceCents, locale)}
              </p>
              {preorderOpen ? (
                <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-hoja-deep transition-colors duration-300 group-hover:bg-chef-ink group-hover:text-white">
                  {t({ es: 'Encárgala', en: 'Pre-order' })}
                  <ArrowRightIcon size={15} />
                </span>
              ) : (
                <span className="inline-flex h-10 items-center rounded-full bg-white/15 px-4 text-[13px] font-semibold text-white/85">{t({ es: 'Ver la caja', en: 'See the box' })}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-1 p-5 sm:p-6">
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
        )}
      </Link>
      {product.quickAdd && !soldOut && (
        <div className="pointer-events-none absolute inset-x-0 top-0 aspect-square">
          <QuickAdd
            product={product}
            label={product.variantCount > 1 ? product.quickAdd.name : null}
            price={formatPrice(product.quickAdd.priceCents, locale)}
          />
        </div>
      )}
    </div>
  )
}

/** Botón «Añadir» de la tarjeta: añade la variante más barata y la miniatura vuela a la cesta. */
function QuickAdd({ product, label, price }: { product: ProductSummary; label: string | null; price: string }) {
  const { t } = useI18n()
  const { addItem, items } = useCart()
  const [added, setAdded] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const variant = product.quickAdd!
  const max = Math.min(variant.stock, commerce.maxQuantityPerLine)
  const inCart = items.find((i) => i.variantId === variant.variantId)?.quantity ?? 0
  const full = inCart >= max

  const add = () => {
    if (full) return
    addItem(
      {
        variantId: variant.variantId,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        variantName: variant.name,
        imageUrl: product.image?.url ?? null,
        priceCents: variant.priceCents,
        quantity: 1,
        maxQuantity: max,
      },
      { openDrawer: false },
    )
    // Vuela la foto que se está viendo (la del hover, si el ratón está encima)
    const imgs = [...(button.current?.closest('.group')?.querySelectorAll('img') ?? [])]
    const shown = imgs.reduce<HTMLImageElement | undefined>((a, b) => (!a || Number(getComputedStyle(b).opacity) > Number(getComputedStyle(a).opacity) ? b : a), undefined)
    void flyToCart(shown, shown?.currentSrc || product.image?.url)
    setAdded(true)
    setTimeout(() => setAdded(false), 1600)
  }

  return (
    <button
      ref={button}
      type="button"
      onClick={add}
      disabled={full}
      aria-label={t({
        es: `Añadir ${product.name}${label ? ` (${label})` : ''} a la cesta, ${price}`,
        en: `Add ${product.name}${label ? ` (${label})` : ''} to bag, ${price}`,
      })}
      className={cn(
        'pointer-events-auto absolute right-3 bottom-3 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold shadow-float transition-[opacity,transform,background-color,color] duration-300 ease-[var(--ease-apple)] disabled:cursor-not-allowed',
        added ? 'bg-hoja-ink text-white' : 'bg-white text-ink hover:bg-ink hover:text-white',
        'lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:focus-visible:translate-y-0 lg:focus-visible:opacity-100',
      )}
    >
      {added ? <CheckIcon size={16} strokeWidth={2.4} /> : <PlusIcon size={16} />}
      {added
        ? t({ es: 'Añadido', en: 'Added' })
        : full
          ? t({ es: 'Máximo en la cesta', en: 'Max in bag' })
          : label
            ? t({ es: `Añadir · ${label}`, en: `Add · ${label}` })
            : t({ es: 'Añadir', en: 'Add' })}
    </button>
  )
}
