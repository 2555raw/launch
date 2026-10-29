'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useCart } from '@/components/cart/cart-context'
import { QuantityStepper } from '@/components/cart/cart-line'
import { Button } from '@/components/ui/button'
import { CheckIcon } from '@/components/ui/icons'
import { Price } from '@/components/ui/price'
import { StockLabel } from '@/components/ui/stock-label'
import { cn } from '@/lib/cn'
import { commerce } from '@/lib/config/commerce'
import { useI18n } from '@/lib/i18n/client'
import { formatPrice, percentOff } from '@/lib/money'
import type { ProductDetail } from '@/lib/types'

export function PurchasePanel({ product }: { product: ProductDetail }) {
  const router = useRouter()
  const { addItem, items } = useCart()
  const { locale, t } = useI18n()
  const firstAvailable = product.variants.find((v) => v.stock > 0) ?? product.variants[0]
  const [variantId, setVariantId] = useState(firstAvailable?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const variant = product.variants.find((v) => v.id === variantId) ?? firstAvailable
  if (!variant) return <p className="text-ash-ink">{t({ es: 'Este producto no tiene variantes disponibles.', en: 'This product has no available options.' })}</p>

  const inCart = items.find((i) => i.variantId === variant.id)?.quantity ?? 0
  const maxForVariant = Math.min(variant.stock, commerce.maxQuantityPerLine)
  const canAdd = Math.max(0, maxForVariant - inCart)
  const soldOut = variant.stock <= 0

  const add = (openDrawer: boolean) => {
    if (canAdd <= 0) return false
    addItem(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        variantName: variant.name,
        imageUrl: product.image?.url ?? null,
        priceCents: variant.priceCents,
        quantity: Math.min(quantity, canAdd),
        maxQuantity: maxForVariant,
      },
      { openDrawer },
    )
    return true
  }

  return (
    <div className="space-y-7">
      <div>
        <Price cents={variant.priceCents} compareAt={variant.compareAtPriceCents} size="lg" />
        <p className="mt-1 text-xs text-ash-ink">
          {t({ es: 'IVA incluido', en: 'VAT included' })}
          {variant.compareAtPriceCents
            ? t({
                es: ` · Ahorras ${formatPrice(variant.compareAtPriceCents - variant.priceCents)} (−${percentOff(variant.priceCents, variant.compareAtPriceCents)} %)`,
                en: ` · You save ${formatPrice(variant.compareAtPriceCents - variant.priceCents, 'en')} (−${percentOff(variant.priceCents, variant.compareAtPriceCents)}%)`,
              })
            : ''}
        </p>
      </div>

      {product.variants.length > 1 && (
        <fieldset>
          <legend className="mb-3 text-[15px] font-semibold">
            {t({ es: 'Elige tamaño', en: 'Choose size' })} <span className="font-normal text-ash-ink">· {variant.name}</span>
          </legend>
          <div className="grid grid-cols-2 gap-3" role="radiogroup">
            {product.variants.map((v) => {
              const selected = v.id === variant.id
              const out = v.stock <= 0
              return (
                <label
                  key={v.id}
                  className={cn(
                    'relative flex cursor-pointer flex-col rounded-[16px] border-2 p-4 transition-[border-color,background-color] duration-200',
                    selected ? 'border-ink bg-white' : 'border-line hover:border-line-strong',
                    out && 'cursor-not-allowed opacity-55',
                  )}
                >
                  <input
                    type="radio"
                    name="variante"
                    value={v.id}
                    checked={selected}
                    disabled={out}
                    onChange={() => {
                      setVariantId(v.id)
                      setQuantity(1)
                    }}
                    className="sr-only"
                  />
                  <span className="text-[15px] font-semibold">{v.name}</span>
                  <span className="text-sm text-ash-ink tabular-nums">
                    {formatPrice(v.priceCents, locale)}
                    {v.compareAtPriceCents && v.compareAtPriceCents > v.priceCents && (
                      <s className="ml-1.5 text-xs text-ash">{formatPrice(v.compareAtPriceCents, locale)}</s>
                    )}
                  </span>
                  {v.compareAtPriceCents && v.compareAtPriceCents > v.priceCents && (
                    <span className="mt-1.5 w-fit rounded-full bg-chef-ink px-2 py-0.5 text-[11px] font-semibold text-white">
                      {t({ es: `Ahorras ${percentOff(v.priceCents, v.compareAtPriceCents)} %`, en: `Save ${percentOff(v.priceCents, v.compareAtPriceCents)}%` })}
                    </span>
                  )}
                  {out && <span className="mt-1 text-xs text-teja">{t({ es: 'Agotado', en: 'Sold out' })}</span>}
                  {selected && (
                    <motion.span layoutId="variant-check" className="absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-ink text-white">
                      <CheckIcon size={12} strokeWidth={2.5} />
                    </motion.span>
                  )}
                </label>
              )
            })}
          </div>
        </fieldset>
      )}

      <div className="space-y-3">
        <StockLabel stock={variant.stock} />
        {!soldOut && (
          <div className="flex items-center gap-4">
            <QuantityStepper value={quantity} max={Math.max(1, canAdd)} onChange={(n) => setQuantity(Math.max(1, Math.min(n, Math.max(1, canAdd))))} label={product.name} />
            {inCart > 0 && (
              <span className="text-sm text-ash-ink">
                {t({
                  es: `Ya tienes ${inCart} en la cesta${canAdd === 0 ? ' (máximo disponible)' : ''}`,
                  en: `You already have ${inCart} in your bag${canAdd === 0 ? ' (maximum available)' : ''}`,
                })}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          disabled={soldOut || canAdd <= 0}
          onClick={() => {
            if (add(true)) {
              setAdded(true)
              setTimeout(() => setAdded(false), 1800)
            }
          }}
          className="relative overflow-hidden"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={added ? 'ok' : 'add'}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="inline-flex items-center gap-2"
            >
              {added ? (
                <>
                  <CheckIcon size={18} /> {t({ es: 'Añadido', en: 'Added' })}
                </>
              ) : soldOut ? (
                t({ es: 'Agotado', en: 'Sold out' })
              ) : (
                t({ es: 'Añadir a la cesta', en: 'Add to bag' })
              )}
            </motion.span>
          </AnimatePresence>
        </Button>
        <Button
          size="lg"
          variant="dark"
          disabled={soldOut || (canAdd <= 0 && inCart === 0)}
          onClick={() => {
            if (canAdd > 0) add(false)
            router.push('/checkout')
          }}
        >
          {t({ es: 'Comprar ahora', en: 'Buy now' })}
        </Button>
      </div>
    </div>
  )
}
