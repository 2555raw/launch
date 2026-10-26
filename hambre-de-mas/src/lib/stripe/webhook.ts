import 'server-only'
import type Stripe from 'stripe'
import { sendOrderConfirmation } from '@/lib/email/order-confirmation'
import type { OrdersService } from '@/lib/orders/service'

/**
 * Procesa un evento de Stripe YA VERIFICADO (la firma se comprueba en la ruta).
 * Todas las operaciones son idempotentes, así que reintentos y eventos
 * duplicados no pueden marcar dos veces un pedido ni descontar dos veces stock.
 */

export type WebhookOutcome = { handled: boolean; result?: string; orderId?: string }

const ASYNC_PAYMENT_HOLD_DAYS = 7

function orderIdFromSession(session: Stripe.Checkout.Session) {
  return session.metadata?.order_id ?? session.client_reference_id ?? null
}

const idOf = (value: string | { id: string } | null | undefined) => (typeof value === 'string' ? value : (value?.id ?? null))

export async function confirmPaidSession(orders: OrdersService, session: Stripe.Checkout.Session) {
  const orderId = orderIdFromSession(session)
  if (!orderId) return { handled: false, result: 'missing_order_id' }
  const result = await orders.markPaid({
    orderId,
    sessionId: session.id,
    paymentIntentId: idOf(session.payment_intent),
    amountTotal: session.amount_total ?? -1,
    currency: session.currency ?? 'eur',
  })
  if (result === 'paid') {
    const order = await orders.getById(orderId)
    if (order) await sendOrderConfirmation(order).catch((e) => console.error('[webhook] email', e))
  }
  return { handled: true, result, orderId }
}

export async function handleStripeEvent(event: Stripe.Event, orders: OrdersService): Promise<WebhookOutcome> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
        return confirmPaidSession(orders, session)
      }
      // Métodos de pago diferidos: mantenemos la reserva mientras se confirma.
      const orderId = orderIdFromSession(session)
      if (orderId) await orders.extendReservation(orderId, new Date(Date.now() + ASYNC_PAYMENT_HOLD_DAYS * 86_400_000))
      return { handled: true, result: 'awaiting_payment', orderId: orderId ?? undefined }
    }
    case 'checkout.session.async_payment_succeeded':
      return confirmPaidSession(orders, event.data.object)

    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      const session = event.data.object
      const orderId = orderIdFromSession(session)
      if (!orderId) return { handled: false, result: 'missing_order_id' }
      const status = event.type === 'checkout.session.expired' ? 'expired' : 'cancelled'
      const result = await orders.release(
        orderId,
        status,
        status === 'expired' ? 'La sesión de pago caducó sin completarse' : 'El pago diferido ha fallado',
      )
      return { handled: true, result, orderId }
    }

    case 'charge.refunded': {
      const charge = event.data.object
      const paymentIntentId = idOf(charge.payment_intent)
      if (!paymentIntentId) return { handled: false, result: 'missing_payment_intent' }
      const result = await orders.markRefunded(paymentIntentId, charge.amount_refunded, charge.refunded)
      return { handled: true, result }
    }

    default:
      return { handled: false }
  }
}
