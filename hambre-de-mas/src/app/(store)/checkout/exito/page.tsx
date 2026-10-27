import type { Metadata } from 'next'
import Link from 'next/link'
import { ClearCartOnMount } from '@/components/cart/clear-cart'
import { buttonClass } from '@/components/ui/button'
import { CheckIcon, ClockIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { isStripeConfigured } from '@/lib/env'
import { getI18n } from '@/lib/i18n/server'
import { formatPrice } from '@/lib/money'
import { formatOrderNumber } from '@/lib/orders/mapper'
import { createOrdersService } from '@/lib/orders/service'
import { getStripe } from '@/lib/stripe/client'
import { confirmPaidSession } from '@/lib/stripe/webhook'
import { isServiceRoleConfigured } from '@/lib/supabase/service'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t({ es: 'Pedido confirmado', en: 'Order confirmed' }), robots: { index: false } }
}
export const dynamic = 'force-dynamic'

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams
  const { locale, t } = await getI18n()
  const price = (cents: number) => formatPrice(cents, locale)
  const emailSoon = t({
    es: 'Si has completado un pago, recibirás un email de confirmación en unos minutos.',
    en: "If you completed a payment, you'll get a confirmation email in a few minutes.",
  })
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !isStripeConfigured() || !isServiceRoleConfigured()) {
    return <Message title={t({ es: 'No encontramos tu pago', en: "We couldn't find your payment" })} text={emailSoon} back={t({ es: 'Volver a la tienda', en: 'Back to the shop' })} />
  }

  const orders = createOrdersService()
  let paid = false
  try {
    // Confirmamos con la API de Stripe (nunca con datos del navegador). Es
    // idempotente: si el webhook llegó antes, no cambia nada.
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    if (session.status === 'complete' && (session.payment_status === 'paid' || session.payment_status === 'no_payment_required')) {
      await confirmPaidSession(orders, session)
      paid = true
    }
  } catch (error) {
    console.error('[checkout/exito] no se pudo verificar la sesión', error)
  }

  const order = await orders.getBySessionId(sessionId)
  if (!order) {
    return <Message title={t({ es: 'No encontramos tu pedido', en: "We couldn't find your order" })} text={emailSoon} back={t({ es: 'Volver a la tienda', en: 'Back to the shop' })} />
  }
  const confirmed = order.status === 'paid'

  return (
    <div className="container-page max-w-3xl py-16 sm:py-24">
      {(confirmed || paid) && <ClearCartOnMount />}
      <div className="text-center">
        <span className={`mx-auto grid size-16 place-items-center rounded-full ${confirmed ? 'bg-hoja/20 text-hoja-deep' : 'bg-almendra text-teja'}`}>
          {confirmed ? <CheckIcon size={30} /> : <ClockIcon size={30} />}
        </span>
        <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          {confirmed ? t({ es: '¡A cocinar!', en: "Let's cook!" }) : t({ es: 'Estamos confirmando tu pago', en: "We're confirming your payment" })}
        </h1>
        <p className="mt-3 text-lg text-ash-ink">
          {confirmed
            ? t({
                es: `Tu pedido ${formatOrderNumber(order.number)} está confirmado. Te hemos enviado los detalles a ${order.email}.`,
                en: `Your order ${formatOrderNumber(order.number)} is confirmed. We've sent the details to ${order.email}.`,
              })
            : t({
                es: `Tu pedido ${formatOrderNumber(order.number)} está registrado. En cuanto el banco confirme el pago te avisaremos por email.`,
                en: `Your order ${formatOrderNumber(order.number)} is registered. We'll email you as soon as the bank confirms the payment.`,
              })}
        </p>
      </div>

      <div className="mt-12 rounded-[28px] bg-mist p-6 sm:p-8">
        <ul className="divide-y divide-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 py-4">
              <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-white">
                {item.imageUrl && <ProductImage src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />}
              </span>
              <span className="flex-1 text-sm">
                <span className="block font-semibold">{item.productName}</span>
                <span className="block text-ash-ink">
                  {item.variantName} · {item.quantity}{' '}
                  {item.quantity === 1 ? t({ es: 'unidad', en: 'unit' }) : t({ es: 'unidades', en: 'units' })}
                </span>
              </span>
              <span className="text-sm tabular-nums">{price(item.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[15px]">
          {order.discountCents > 0 && (
            <div className="flex justify-between">
              <dt>{t({ es: 'Descuento', en: 'Discount' })}</dt>
              <dd className="text-hoja-ink tabular-nums">−{price(order.discountCents)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>{t({ es: 'Envío', en: 'Shipping' })}</dt>
            <dd className="tabular-nums">{order.shippingCents ? price(order.shippingCents) : t({ es: 'Gratis', en: 'Free' })}</dd>
          </div>
          <div className="flex justify-between text-lg font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{price(order.totalCents)}</dd>
          </div>
        </dl>
        <p className="mt-6 text-sm text-ash-ink">
          {t({ es: 'Envío a', en: 'Shipping to' })} {order.shippingAddress.fullName}, {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.postalCode} {order.shippingAddress.city} (
          {order.shippingAddress.province}).
        </p>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/tienda" className={buttonClass('primary', 'lg')}>
          {t({ es: 'Seguir comprando', en: 'Continue shopping' })}
        </Link>
        {order.userId && (
          <Link href={`/cuenta/pedidos/${order.id}`} className={buttonClass('secondary', 'lg')}>
            {t({ es: 'Ver mi pedido', en: 'View my order' })}
          </Link>
        )}
      </div>
    </div>
  )
}

function Message({ title, text, back }: { title: string; text: string; back: string }) {
  return (
    <div className="container-page max-w-2xl py-24 text-center">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-3 text-ash-ink">{text}</p>
      <Link href="/" className={buttonClass('primary', 'lg', 'mt-8')}>
        {back}
      </Link>
    </div>
  )
}
