'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CloseIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'
import { formatPrice } from '@/lib/money'
import type { Quote } from '@/lib/pricing/quote'
import { useCart } from './cart-context'

function Row({ label, value, strong, muted }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', strong ? 'text-lg font-semibold' : 'text-[15px]', muted && 'text-ash-ink')}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

export function PromoCodeField() {
  const { promoCode, setPromoCode } = useCart()
  const { t } = useI18n()
  const [open, setOpen] = useState(Boolean(promoCode))
  const [value, setValue] = useState(promoCode ?? '')

  if (promoCode) {
    return (
      <div className="flex items-center justify-between rounded-2xl bg-mist px-4 py-3 text-sm">
        <span>
          {t({ es: 'Código', en: 'Code' })} <strong className="font-semibold">{promoCode}</strong>
        </span>
        <button
          type="button"
          onClick={() => {
            setPromoCode(null)
            setValue('')
          }}
          className="inline-flex items-center gap-1 text-ash-ink hover:text-teja"
          aria-label={t({ es: 'Quitar código promocional', en: 'Remove promo code' })}
        >
          <CloseIcon size={14} /> {t({ es: 'Quitar', en: 'Remove' })}
        </button>
      </div>
    )
  }

  return open ? (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) setPromoCode(value)
      }}
      className="flex gap-2"
    >
      <label htmlFor="promo" className="sr-only">
        {t({ es: 'Código promocional', en: 'Promo code' })}
      </label>
      <input
        id="promo"
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        placeholder={t({ es: 'Código promocional', en: 'Promo code' })}
        maxLength={32}
        autoComplete="off"
        className="h-11 min-w-0 flex-1 rounded-full border border-line-strong px-4 text-sm uppercase placeholder:normal-case focus:border-ink focus:outline-none"
      />
      <Button type="submit" variant="secondary" size="md">
        {t({ es: 'Aplicar', en: 'Apply' })}
      </Button>
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="text-sm text-teja hover:underline">
      {t({ es: '¿Tienes un código promocional?', en: 'Got a promo code?' })}
    </button>
  )
}

export function OrderSummary({ quote, loading, children }: { quote: Quote | null; loading: boolean; children?: React.ReactNode }) {
  const { locale, t } = useI18n()
  const price = (cents: number) => formatPrice(cents, locale)
  return (
    <div className={cn('space-y-5 transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
      <dl className="space-y-3">
        <Row label="Subtotal" value={quote ? price(quote.subtotalCents) : '—'} />
        <AnimatePresence initial={false}>
          {quote?.bundles.map((b) => (
            <motion.div key={`pack-${b.level}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Row
                label={t({ es: `Pack Nivel ${b.level} (${b.kits} kits)`, en: `Level ${b.level} bundle (${b.kits} kits)` })}
                value={<span className="text-hoja-ink">−{price(b.discountCents)}</span>}
              />
            </motion.div>
          ))}
          {quote && quote.promotionDiscountCents > 0 && (
            <motion.div key="promo" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Row
                label={`${t({ es: 'Descuento', en: 'Discount' })} (${quote.promotion?.code})`}
                value={<span className="text-hoja-ink">−{price(quote.promotionDiscountCents)}</span>}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <Row
          label={t({ es: 'Envío', en: 'Shipping' })}
          value={
            quote ? (
              quote.shippingCents === 0 && quote.itemCount > 0 ? (
                <span className="text-hoja-ink">{t({ es: 'Gratis', en: 'Free' })}</span>
              ) : (
                price(quote.shippingCents)
              )
            ) : (
              '—'
            )
          }
        />
        {quote?.bundleHint && (
          <p className="rounded-2xl bg-almendra-soft px-4 py-3 text-[13px] text-teja">
            {t({
              es: `Añade ${quote.bundleHint.missing} ${quote.bundleHint.missing === 1 ? 'kit' : 'kits'} más de Nivel ${quote.bundleHint.level} y te descontamos un ${quote.bundleHint.percent} % en todos los de ese nivel.`,
              en: `Add ${quote.bundleHint.missing} more Level ${quote.bundleHint.level} ${quote.bundleHint.missing === 1 ? 'kit' : 'kits'} and get ${quote.bundleHint.percent}% off all kits of that level.`,
            })}
          </p>
        )}
        {quote && quote.freeShippingRemainingCents > 0 && quote.itemCount > 0 && (
          <p className="text-xs text-ash-ink">
            {t({
              es: `Añade ${price(quote.freeShippingRemainingCents)} más y el envío es gratis.`,
              en: `Add ${price(quote.freeShippingRemainingCents)} more for free shipping.`,
            })}
          </p>
        )}
        <div className="border-t border-line pt-3">
          <Row label="Total" value={quote ? price(quote.totalCents) : '—'} strong />
          {quote && quote.taxes.length > 0 && (
            <p className="mt-1 text-right text-xs text-ash-ink">
              {t({ es: 'Incluye', en: 'Includes' })}{' '}
              {quote.taxes.map((tax, i) => (
                <span key={tax.rateBps}>
                  {i > 0 && t({ es: ' y ', en: ' and ' })}
                  {t({
                    es: `${price(tax.amountCents)} de IVA (${tax.rateBps / 100} %)`,
                    en: `${price(tax.amountCents)} VAT (${tax.rateBps / 100}%)`,
                  })}
                </span>
              ))}
            </p>
          )}
        </div>
      </dl>
      {quote?.promotion && !quote.promotion.applied && (
        <p className="rounded-2xl bg-almendra-soft px-4 py-3 text-sm text-teja" role="alert">
          {quote.promotion.message}
        </p>
      )}
      {children}
    </div>
  )
}
