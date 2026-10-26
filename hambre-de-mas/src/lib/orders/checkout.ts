import 'server-only'
import type Stripe from 'stripe'
import { commerce } from '@/lib/config/commerce'
import { NEWSLETTER_CONSENT } from '@/lib/config/consent'
import { site } from '@/lib/config/site'
import { isStripeConfigured } from '@/lib/env'
import { quoteCart } from '@/lib/pricing/server-quote'
import type { Quote } from '@/lib/pricing/quote'
import { getStripe } from '@/lib/stripe/client'
import { isServiceRoleConfigured } from '@/lib/supabase/service'
import type { CheckoutInput } from '@/lib/validation/schemas'
import { formatOrderNumber } from './mapper'
import { OrderError, createOrdersService, type OrdersService } from './service'
import { signOrderId } from './token'

export type CheckoutResult =
  | { ok: true; url: string; orderId: string }
  | { ok: false; code: string; message: string; quote?: Quote }

/** Convierte una ruta relativa en URL absoluta solo si es pública (https). */
function publicImage(url: string | null) {
  if (!url) return undefined
  const absolute = url.startsWith('http') ? url : `${site.url}${url}`
  return absolute.startsWith('https://') ? [absolute] : undefined
}

/**
 * Flujo completo de inicio de pago:
 *  1. Recalcula el carrito con precios y stock del servidor.
 *  2. Crea el pedido pendiente y reserva el stock (transacción SQL).
 *  3. Crea la sesión de Stripe Checkout con esos mismos importes.
 * Si Stripe falla, el pedido se cancela y el stock vuelve a estar disponible.
 */
export async function startCheckout(
  input: CheckoutInput,
  options: { userId: string | null; origin: string },
  deps: { orders?: OrdersService; stripe?: Stripe } = {},
): Promise<CheckoutResult> {
  if (!isServiceRoleConfigured() || (!deps.stripe && !isStripeConfigured())) {
    return {
      ok: false,
      code: 'payments_not_configured',
      message: 'Los pagos todavía no están activados en esta tienda.',
    }
  }

  const quote = await quoteCart(input.items, input.promoCode)
  if (!quote.isClean) {
    return { ok: false, code: 'cart_changed', message: 'Tu carrito ha cambiado: revisa las cantidades disponibles.', quote }
  }
  if (input.promoCode && !quote.promotion?.applied) {
    return { ok: false, code: 'promotion_invalid', message: quote.promotion?.message ?? 'El código no es válido.', quote }
  }
  if (!quote.isPurchasable) {
    return { ok: false, code: 'not_purchasable', message: 'El pedido mínimo es de 0,50 €.', quote }
  }

  const orders = deps.orders ?? createOrdersService()
  const stripe = deps.stripe ?? getStripe()
  const now = Date.now()
  const billable = quote.lines.filter((l) => l.quantity > 0)

  let order: { id: string; number: number }
  try {
    order = await orders.createPendingOrder({
      userId: options.userId,
      email: input.email,
      customerName: input.address.fullName,
      phone: input.address.phone ?? null,
      shippingAddress: input.address,
      promotionId: quote.promotion?.applied ? quote.promotion.promotionId : null,
      subtotalCents: quote.subtotalCents,
      discountCents: quote.discountCents,
      shippingCents: quote.shippingCents,
      taxCents: quote.taxCents,
      totalCents: quote.totalCents,
      expiresAt: new Date(now + commerce.reservationMinutes * 60_000),
      items: billable.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPriceCents: l.unitPriceCents })),
    })
  } catch (error) {
    if (error instanceof OrderError) {
      return { ok: false, code: error.code, message: error.message, quote: await quoteCart(input.items, input.promoCode) }
    }
    throw error
  }

  try {
    const number = formatOrderNumber(order.number)
    const metadata = { order_id: order.id, order_number: number }

    let coupon: string | undefined
    if (quote.discountCents > 0) {
      const created = await stripe.coupons.create(
        {
          amount_off: quote.discountCents,
          currency: 'eur',
          duration: 'once',
          max_redemptions: 1,
          name: `${quote.promotion?.code ?? 'Descuento'} · ${number}`.slice(0, 40),
          metadata,
        },
        { idempotencyKey: `coupon-${order.id}` },
      )
      coupon = created.id
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        locale: 'es',
        currency: 'eur',
        customer_email: input.email,
        client_reference_id: order.id,
        metadata,
        payment_intent_data: { metadata, description: `Pedido ${number}` },
        line_items: billable.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency: 'eur',
            unit_amount: l.unitPriceCents,
            tax_behavior: 'inclusive',
            product_data: {
              name: `${l.productName} · ${l.variantName}`,
              images: publicImage(l.imageUrl),
              metadata: { variant_id: l.variantId, sku: l.sku ?? '' },
            },
          },
        })),
        shipping_options: [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              display_name: quote.shippingCents > 0 ? 'Envío estándar' : 'Envío gratis',
              fixed_amount: { amount: quote.shippingCents, currency: 'eur' },
              tax_behavior: 'inclusive',
              delivery_estimate: {
                minimum: { unit: 'business_day', value: 1 },
                maximum: { unit: 'business_day', value: 3 },
              },
            },
          },
        ],
        discounts: coupon ? [{ coupon }] : undefined,
        expires_at: Math.floor(now / 1000) + commerce.checkoutSessionMinutes * 60,
        success_url: `${options.origin}/checkout/exito?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${options.origin}/checkout/cancelado?pedido=${order.id}&t=${signOrderId(order.id)}`,
      },
      { idempotencyKey: `checkout-${order.id}` },
    )

    if (session.amount_total != null && session.amount_total !== quote.totalCents) {
      throw new Error(`Stripe calcula ${session.amount_total} y el pedido ${quote.totalCents}`)
    }
    if (!session.url) throw new Error('Stripe no ha devuelto URL de pago')

    await orders.attachCheckoutSession(order.id, session.id)

    if (options.userId && input.saveAddress) await orders.saveAddress(options.userId, input.address)
    if (input.newsletter) await orders.subscribeNewsletter(input.email, NEWSLETTER_CONSENT)

    return { ok: true, url: session.url, orderId: order.id }
  } catch (error) {
    console.error('[checkout] fallo al crear la sesión de pago', error)
    await orders.release(order.id, 'cancelled', 'No se pudo crear la sesión de pago').catch(() => undefined)
    return { ok: false, code: 'payment_error', message: 'No hemos podido conectar con la pasarela de pago. Inténtalo de nuevo.' }
  }
}
