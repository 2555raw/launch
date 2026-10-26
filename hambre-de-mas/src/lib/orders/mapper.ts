import type { Order, OrderItem } from '@/lib/types'

/* eslint-disable @typescript-eslint/no-explicit-any -- filas sin tipar de PostgREST */

export const ORDER_SELECT = '*, items:order_items(*)'

export function mapOrderItem(r: any): OrderItem {
  return {
    id: r.id,
    productId: r.product_id,
    variantId: r.variant_id,
    productName: r.product_name,
    productSlug: r.product_slug,
    variantName: r.variant_name,
    sku: r.sku,
    imageUrl: r.image_url,
    unitPriceCents: r.unit_price_cents,
    quantity: r.quantity,
    taxRateBps: r.tax_rate_bps,
    lineTotalCents: r.line_total_cents,
  }
}

export function mapOrder(r: any): Order {
  return {
    id: r.id,
    number: Number(r.number),
    userId: r.user_id,
    email: r.email,
    customerName: r.customer_name,
    phone: r.phone,
    shippingAddress: r.shipping_address,
    status: r.status,
    fulfillmentStatus: r.fulfillment_status,
    subtotalCents: r.subtotal_cents,
    discountCents: r.discount_cents,
    shippingCents: r.shipping_cents,
    taxCents: r.tax_cents,
    totalCents: r.total_cents,
    promotionCode: r.promotion_code,
    stripeCheckoutSessionId: r.stripe_checkout_session_id,
    stripePaymentIntentId: r.stripe_payment_intent_id,
    trackingCarrier: r.tracking_carrier,
    trackingNumber: r.tracking_number,
    trackingUrl: r.tracking_url,
    adminNotes: r.admin_notes,
    paidAt: r.paid_at,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    items: (r.items ?? []).map(mapOrderItem),
  }
}

export const formatOrderNumber = (n: number) => `HDM-${String(n).padStart(6, '0')}`

export const orderStatusLabel: Record<Order['status'], string> = {
  pending: 'Pendiente de pago',
  paid: 'Pagado',
  cancelled: 'Cancelado',
  expired: 'Caducado',
  refunded: 'Reembolsado',
  requires_review: 'En revisión',
}

export const fulfillmentStatusLabel: Record<Order['fulfillmentStatus'], string> = {
  unfulfilled: 'Sin preparar',
  preparing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Entregado',
  returned: 'Devuelto',
}
