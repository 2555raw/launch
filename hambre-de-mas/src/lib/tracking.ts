'use client'

/**
 * Eventos de comercio para Google Analytics 4 y la conversión de Google Ads.
 *
 * Solo hacen algo si el cliente ha aceptado las cookies correspondientes: el
 * script de Google (gtag) lo carga CookieConsent tras el consentimiento y,
 * mientras no exista, estas funciones no envían nada.
 */

export const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || null
/** Cuenta de Google Ads (AW-123456789) y etiqueta de la conversión «Compra». */
export const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || null
const adsPurchaseLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL || null

type Gtag = (...args: unknown[]) => void
const gtag = (): Gtag | null => (typeof window !== 'undefined' && typeof (window as { gtag?: Gtag }).gtag === 'function' ? (window as unknown as { gtag: Gtag }).gtag : null)

export type TrackedItem = { id: string; name: string; variant?: string; priceCents: number; quantity: number; category?: string | null }

const toGa = (items: TrackedItem[]) =>
  items.map((i) => ({ item_id: i.id, item_name: i.name, item_variant: i.variant, item_category: i.category ?? undefined, price: i.priceCents / 100, quantity: i.quantity }))
const value = (items: TrackedItem[]) => items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0) / 100

export function trackAddToCart(item: TrackedItem) {
  gtag()?.('event', 'add_to_cart', { currency: 'EUR', value: value([item]), items: toGa([item]) })
}

export function trackBeginCheckout(items: TrackedItem[]) {
  if (items.length) gtag()?.('event', 'begin_checkout', { currency: 'EUR', value: value(items), items: toGa(items) })
}

/** Compra confirmada: evento de GA4 y conversión de Google Ads con el importe real (una sola vez por pedido). */
export function trackPurchase(order: { id: string; totalCents: number; shippingCents: number; taxCents: number; coupon?: string | null; items: TrackedItem[] }) {
  const send = gtag()
  if (!send) return
  const key = `hdm:tracked:${order.id}`
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    // Sin sessionStorage (navegación privada estricta): se envía igualmente
  }
  const total = order.totalCents / 100
  send('event', 'purchase', {
    transaction_id: order.id,
    currency: 'EUR',
    value: total,
    shipping: order.shippingCents / 100,
    tax: order.taxCents / 100,
    coupon: order.coupon ?? undefined,
    items: toGa(order.items),
  })
  if (adsId && adsPurchaseLabel) send('event', 'conversion', { send_to: `${adsId}/${adsPurchaseLabel}`, value: total, currency: 'EUR', transaction_id: order.id })
}
