'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CloseIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
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
  const [open, setOpen] = useState(Boolean(promoCode))
  const [value, setValue] = useState(promoCode ?? '')

  if (promoCode) {
    return (
      <div className="flex items-center justify-between rounded-2xl bg-mist px-4 py-3 text-sm">
        <span>
          Código <strong className="font-semibold">{promoCode}</strong>
        </span>
        <button
          type="button"
          onClick={() => {
            setPromoCode(null)
            setValue('')
          }}
          className="inline-flex items-center gap-1 text-ash-ink hover:text-teja"
          aria-label="Quitar código promocional"
        >
          <CloseIcon size={14} /> Quitar
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
        Código promocional
      </label>
      <input
        id="promo"
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        placeholder="Código promocional"
        maxLength={32}
        autoComplete="off"
        className="h-11 min-w-0 flex-1 rounded-full border border-line-strong px-4 text-sm uppercase placeholder:normal-case focus:border-ink focus:outline-none"
      />
      <Button type="submit" variant="secondary" size="md">
        Aplicar
      </Button>
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="text-sm text-teja hover:underline">
      ¿Tienes un código promocional?
    </button>
  )
}

export function OrderSummary({ quote, loading, children }: { quote: Quote | null; loading: boolean; children?: React.ReactNode }) {
  return (
    <div className={cn('space-y-5 transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
      <dl className="space-y-3">
        <Row label="Subtotal" value={quote ? formatPrice(quote.subtotalCents) : '—'} />
        <AnimatePresence initial={false}>
          {quote && quote.discountCents > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Row label={`Descuento (${quote.promotion?.code})`} value={<span className="text-hoja-ink">−{formatPrice(quote.discountCents)}</span>} />
            </motion.div>
          )}
        </AnimatePresence>
        <Row
          label="Envío"
          value={quote ? (quote.shippingCents === 0 && quote.itemCount > 0 ? <span className="text-hoja-ink">Gratis</span> : formatPrice(quote.shippingCents)) : '—'}
        />
        {quote && quote.freeShippingRemainingCents > 0 && quote.itemCount > 0 && (
          <p className="text-xs text-ash-ink">Añade {formatPrice(quote.freeShippingRemainingCents)} más y el envío es gratis.</p>
        )}
        <div className="border-t border-line pt-3">
          <Row label="Total" value={quote ? formatPrice(quote.totalCents) : '—'} strong />
          {quote && quote.taxes.length > 0 && (
            <p className="mt-1 text-right text-xs text-ash-ink">
              Incluye{' '}
              {quote.taxes.map((t, i) => (
                <span key={t.rateBps}>
                  {i > 0 && ' y '}
                  {formatPrice(t.amountCents)} de IVA ({t.rateBps / 100} %)
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
