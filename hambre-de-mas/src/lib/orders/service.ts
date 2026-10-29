import 'server-only'
import { createSupabaseServiceClient } from '@/lib/supabase/service'
import type { Order, ShippingAddress } from '@/lib/types'
import { ORDER_SELECT, mapOrder } from './mapper'

/**
 * Operaciones de pedidos que hace el servidor con la service role. Toda la
 * lógica delicada (stock, importes, idempotencia) vive en funciones SQL que
 * se ejecutan en una transacción; aquí solo se llaman.
 */

export class OrderError extends Error {
  constructor(
    public code: string,
    message: string,
    public variantId?: string,
  ) {
    super(message)
  }
}

const friendly: Record<string, string> = {
  empty_cart: 'Tu carrito está vacío.',
  variant_not_found: 'Uno de los productos ya no existe.',
  variant_unavailable: 'Uno de los productos ya no está a la venta.',
  invalid_quantity: 'Hay una cantidad no válida en el carrito.',
  price_changed: 'El precio de un producto acaba de cambiar. Revisa tu carrito.',
  insufficient_stock: 'Alguien se te ha adelantado: ya no queda stock suficiente de un producto.',
  subtotal_mismatch: 'El importe del carrito ha cambiado. Revisa tu carrito.',
  promotion_invalid: 'El código promocional ya no es válido.',
}

export type CreateOrderPayload = {
  userId: string | null
  email: string
  customerName: string
  phone: string | null
  shippingAddress: ShippingAddress
  promotionId: string | null
  subtotalCents: number
  discountCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
  expiresAt: Date
  items: { variantId: string; quantity: number; unitPriceCents: number }[]
}

export type OrdersService = ReturnType<typeof createOrdersService>

export function createOrdersService() {
  const db = () => createSupabaseServiceClient()

  return {
    async createPendingOrder(payload: CreateOrderPayload): Promise<{ id: string; number: number }> {
      const { data, error } = await db().rpc('create_order', {
        p_order: {
          user_id: payload.userId,
          email: payload.email,
          customer_name: payload.customerName,
          phone: payload.phone,
          shipping_address: payload.shippingAddress,
          promotion_id: payload.promotionId,
          subtotal_cents: payload.subtotalCents,
          discount_cents: payload.discountCents,
          shipping_cents: payload.shippingCents,
          tax_cents: payload.taxCents,
          total_cents: payload.totalCents,
          expires_at: payload.expiresAt.toISOString(),
          items: payload.items.map((i) => ({
            variant_id: i.variantId,
            quantity: i.quantity,
            unit_price_cents: i.unitPriceCents,
          })),
        },
      })
      if (error) {
        const code = error.message
        throw new OrderError(code, friendly[code] ?? 'No hemos podido crear el pedido. Inténtalo de nuevo.', error.details ?? undefined)
      }
      return { id: data.id, number: Number(data.number) }
    },

    /** Idioma del cliente (para los emails) y, si lo es, regalo con su mensaje. */
    async setOrderDetails(orderId: string, details: { locale: 'es' | 'en'; isGift: boolean; giftMessage: string | null }) {
      const { error } = await db()
        .from('orders')
        .update({ locale: details.locale, is_gift: details.isGift, gift_message: details.isGift ? details.giftMessage : null })
        .eq('id', orderId)
      if (error) throw new Error(`[pedidos] guardar detalles: ${error.message}`)
    },

    /** Pedidos entregados (o enviados hace días) a los que aún no se ha pedido opinión. */
    async listDueReviewRequests(deliveredDaysAgo: number, shippedDaysAgo: number, limit = 50): Promise<Order[]> {
      const day = 86_400_000
      const delivered = new Date(Date.now() - deliveredDaysAgo * day).toISOString()
      const shipped = new Date(Date.now() - shippedDaysAgo * day).toISOString()
      const { data, error } = await db()
        .from('orders')
        .select(ORDER_SELECT)
        .eq('status', 'paid')
        .is('review_requested_at', null)
        .or(`delivered_at.lte.${delivered},shipped_at.lte.${shipped}`)
        .order('shipped_at', { ascending: true })
        .limit(limit)
      if (error) throw new Error(`[pedidos] opiniones pendientes: ${error.message}`)
      return (data ?? []).map(mapOrder)
    },

    async markReviewRequested(orderId: string) {
      const { error } = await db().from('orders').update({ review_requested_at: new Date().toISOString() }).eq('id', orderId)
      if (error) throw new Error(`[pedidos] marcar opinión pedida: ${error.message}`)
    },

    async attachCheckoutSession(orderId: string, sessionId: string) {
      const { error } = await db().from('orders').update({ stripe_checkout_session_id: sessionId }).eq('id', orderId)
      if (error) throw new Error(`[pedidos] guardar sesión: ${error.message}`)
    },

    async extendReservation(orderId: string, until: Date) {
      const { error } = await db()
        .from('orders')
        .update({ expires_at: until.toISOString() })
        .eq('id', orderId)
        .eq('status', 'pending')
      if (error) throw new Error(`[pedidos] ampliar reserva: ${error.message}`)
    },

    async markPaid(input: { orderId: string; sessionId: string; paymentIntentId: string | null; amountTotal: number; currency: string }) {
      const { data, error } = await db().rpc('mark_order_paid', {
        p_order_id: input.orderId,
        p_session_id: input.sessionId,
        p_payment_intent_id: input.paymentIntentId,
        p_amount_total: input.amountTotal,
        p_currency: input.currency,
      })
      if (error) throw new Error(`[pedidos] marcar pagado: ${error.message}`)
      return data as 'paid' | 'already_paid' | 'requires_review'
    },

    async release(orderId: string, status: 'cancelled' | 'expired', reason?: string) {
      const { data, error } = await db().rpc('release_order', { p_order_id: orderId, p_status: status, p_reason: reason ?? null })
      if (error) throw new Error(`[pedidos] liberar: ${error.message}`)
      return data as string
    },

    async markRefunded(paymentIntentId: string, amountRefunded: number, fullyRefunded: boolean) {
      const { data, error } = await db().rpc('mark_order_refunded', {
        p_payment_intent_id: paymentIntentId,
        p_amount_refunded: amountRefunded,
        p_fully_refunded: fullyRefunded,
      })
      if (error) throw new Error(`[pedidos] reembolso: ${error.message}`)
      return data as string
    },

    async expireStale() {
      const { data, error } = await db().rpc('expire_stale_orders')
      if (error) throw new Error(`[pedidos] caducar: ${error.message}`)
      return Number(data)
    },

    async getById(orderId: string): Promise<Order | null> {
      const { data, error } = await db().from('orders').select(ORDER_SELECT).eq('id', orderId).maybeSingle()
      if (error) throw new Error(`[pedidos] leer: ${error.message}`)
      return data ? mapOrder(data) : null
    },

    async getBySessionId(sessionId: string): Promise<Order | null> {
      const { data, error } = await db().from('orders').select(ORDER_SELECT).eq('stripe_checkout_session_id', sessionId).maybeSingle()
      if (error) throw new Error(`[pedidos] leer por sesión: ${error.message}`)
      return data ? mapOrder(data) : null
    },

    /** Devuelve false si el evento ya se había procesado. */
    async hasProcessedEvent(eventId: string) {
      const { data, error } = await db().from('stripe_events').select('id').eq('id', eventId).maybeSingle()
      if (error) throw new Error(`[pedidos] eventos: ${error.message}`)
      return Boolean(data)
    },

    async recordEvent(eventId: string, type: string) {
      const { error } = await db().from('stripe_events').upsert({ id: eventId, type }, { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw new Error(`[pedidos] registrar evento: ${error.message}`)
    },

    async saveAddress(userId: string, address: ShippingAddress) {
      const { count } = await db().from('addresses').select('id', { count: 'exact', head: true }).eq('user_id', userId)
      const { error } = await db()
        .from('addresses')
        .insert({
          user_id: userId,
          full_name: address.fullName,
          phone: address.phone ?? null,
          line1: address.line1,
          line2: address.line2 ?? null,
          city: address.city,
          province: address.province,
          postal_code: address.postalCode,
          country: address.country,
          is_default: (count ?? 0) === 0,
        })
      if (error) console.warn('[pedidos] no se pudo guardar la dirección', error.message)
    },

    async subscribeNewsletter(email: string, consentText: string) {
      const { error } = await db()
        .from('newsletter_subscribers')
        .upsert({ email, consent_text: consentText, unsubscribed_at: null }, { onConflict: 'email' })
      if (error) console.warn('[newsletter] alta fallida', error.message)
    },
  }
}
