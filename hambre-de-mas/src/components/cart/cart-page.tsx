'use client'

import { AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { buttonClass } from '@/components/ui/button'
import { BagIcon, LockIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'
import { useCart } from './cart-context'
import { CartLine } from './cart-line'
import { OrderSummary, PromoCodeField } from './order-summary'
import { useCartQuote } from './use-quote'

export function CartPageClient() {
  const { items, hydrated } = useCart()
  const { t } = useI18n()
  const { quote, loading, error } = useCartQuote()

  if (!hydrated) {
    return <div className="container-page h-96 animate-pulse rounded-[28px] bg-mist" aria-label={t({ es: 'Cargando cesta', en: 'Loading bag' })} />
  }

  if (items.length === 0) {
    return (
      <div className="container-page flex flex-col items-center py-24 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-almendra-soft text-teja">
          <BagIcon size={34} />
        </span>
        <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight">{t({ es: 'Tu cesta está vacía.', en: 'Your bag is empty.' })}</h1>
        <p className="mt-3 max-w-md text-ash-ink">
          {t({
            es: '¿Con hambre de más? Empieza por un kit de nivel 1 o ve directo a por el ramen.',
            en: 'Hungry for more? Start with a level 1 kit or go straight for the ramen.',
          })}
        </p>
        <Link href="/tienda" className={buttonClass('primary', 'lg', 'mt-8')}>
          {t({ es: 'Ver los kits', en: 'Browse kits' })}
        </Link>
      </div>
    )
  }

  const hasIssues = quote ? !quote.isClean : false

  return (
    <div className="container-page grid gap-12 pt-10 pb-24 lg:grid-cols-[1fr_380px]">
      <section aria-labelledby="cesta">
        <h1 id="cesta" className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          {t({ es: 'Revisa tu cesta.', en: 'Review your bag.' })}
        </h1>
        <p className="mt-2 text-ash-ink">
          {t({ es: 'Envío en 24-72 h laborables a Península y Baleares.', en: 'Delivery in 24–72 working hours to mainland Spain and the Balearic Islands.' })}
        </p>
        <ul className="mt-6 divide-y divide-line border-y border-line">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <CartLine key={item.variantId} item={item} quoteLine={quote?.lines.find((l) => l.variantId === item.variantId)} />
            ))}
          </AnimatePresence>
        </ul>
        <Link href="/tienda" className="mt-6 inline-block text-[15px] text-teja hover:underline">
          ← {t({ es: 'Seguir comprando', en: 'Continue shopping' })}
        </Link>
      </section>

      <aside aria-label={t({ es: 'Resumen del pedido', en: 'Order summary' })} className="lg:pt-24">
        <div className="sticky top-20 rounded-[28px] bg-mist p-6">
          <h2 className="mb-5 font-display text-xl font-bold">{t({ es: 'Resumen', en: 'Summary' })}</h2>
          <OrderSummary quote={quote} loading={loading}>
            <PromoCodeField />
            {error && (
              <p className="text-sm text-teja" role="alert">
                {error}
              </p>
            )}
            {hasIssues && (
              <p className="text-sm text-teja" role="alert">
                {t({
                  es: 'Algunos productos han cambiado de disponibilidad. Ajusta la cesta para continuar.',
                  en: 'Some products have changed availability. Adjust your bag to continue.',
                })}
              </p>
            )}
            <Link
              href="/checkout"
              aria-disabled={hasIssues || !quote?.isPurchasable}
              className={cn(buttonClass('primary', 'lg', 'w-full'), (hasIssues || !quote?.isPurchasable) && 'pointer-events-none opacity-45')}
            >
              <LockIcon size={18} /> {t({ es: 'Tramitar pedido', en: 'Checkout' })}
            </Link>
            <p className="text-center text-xs text-ash-ink">
              {t({ es: 'Pago seguro con Stripe. No guardamos los datos de tu tarjeta.', en: "Secure payment with Stripe. We never store your card details." })}
            </p>
          </OrderSummary>
        </div>
      </aside>
    </div>
  )
}
