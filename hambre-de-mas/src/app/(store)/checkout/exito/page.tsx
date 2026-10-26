import type { Metadata } from 'next'
import Link from 'next/link'
import { ClearCartOnMount } from '@/components/cart/clear-cart'
import { buttonClass } from '@/components/ui/button'
import { CheckIcon, ClockIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { isStripeConfigured } from '@/lib/env'
import { formatPrice } from '@/lib/money'
import { formatOrderNumber } from '@/lib/orders/mapper'
import { createOrdersService } from '@/lib/orders/service'
import { getStripe } from '@/lib/stripe/client'
import { confirmPaidSession } from '@/lib/stripe/webhook'
import { isServiceRoleConfigured } from '@/lib/supabase/service'

export const metadata: Metadata = { title: 'Pedido confirmado', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !isStripeConfigured() || !isServiceRoleConfigured()) {
    return <Message title="No encontramos tu pago" text="Si has completado un pago, recibirás un email de confirmación en unos minutos." />
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
    return <Message title="No encontramos tu pedido" text="Si has completado un pago, recibirás un email de confirmación en unos minutos." />
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
          {confirmed ? '¡A cocinar!' : 'Estamos confirmando tu pago'}
        </h1>
        <p className="mt-3 text-lg text-ash-ink">
          {confirmed
            ? `Tu pedido ${formatOrderNumber(order.number)} está confirmado. Te hemos enviado los detalles a ${order.email}.`
            : `Tu pedido ${formatOrderNumber(order.number)} está registrado. En cuanto el banco confirme el pago te avisaremos por email.`}
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
                  {item.variantName} · {item.quantity} {item.quantity === 1 ? 'unidad' : 'unidades'}
                </span>
              </span>
              <span className="text-sm tabular-nums">{formatPrice(item.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[15px]">
          {order.discountCents > 0 && (
            <div className="flex justify-between">
              <dt>Descuento</dt>
              <dd className="text-hoja-ink tabular-nums">−{formatPrice(order.discountCents)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Envío</dt>
            <dd className="tabular-nums">{order.shippingCents ? formatPrice(order.shippingCents) : 'Gratis'}</dd>
          </div>
          <div className="flex justify-between text-lg font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPrice(order.totalCents)}</dd>
          </div>
        </dl>
        <p className="mt-6 text-sm text-ash-ink">
          Envío a {order.shippingAddress.fullName}, {order.shippingAddress.line1}
          {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}, {order.shippingAddress.postalCode} {order.shippingAddress.city} (
          {order.shippingAddress.province}).
        </p>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/tienda" className={buttonClass('primary', 'lg')}>
          Seguir comprando
        </Link>
        {order.userId && (
          <Link href={`/cuenta/pedidos/${order.id}`} className={buttonClass('secondary', 'lg')}>
            Ver mi pedido
          </Link>
        )}
      </div>
    </div>
  )
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="container-page max-w-2xl py-24 text-center">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-3 text-ash-ink">{text}</p>
      <Link href="/" className={buttonClass('primary', 'lg', 'mt-8')}>
        Volver a la tienda
      </Link>
    </div>
  )
}
