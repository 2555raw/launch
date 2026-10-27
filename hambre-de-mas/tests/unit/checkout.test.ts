import type Stripe from 'stripe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Quote } from '@/lib/pricing/quote'
import { OrderError, type OrdersService } from '@/lib/orders/service'
import type { CheckoutInput } from '@/lib/validation/schemas'

const quoteCart = vi.fn()
vi.mock('@/lib/pricing/server-quote', () => ({ quoteCart: (...args: unknown[]) => quoteCart(...args) }))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
process.env.STRIPE_SECRET_KEY = 'sk_test_x'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_x'

const { startCheckout } = await import('@/lib/orders/checkout')

const V = '11111111-1111-4111-8111-111111111111'

const quote = (over: Partial<Quote> = {}): Quote => ({
  lines: [
    {
      variantId: V,
      productId: 'p1',
      productSlug: 'kit-ramen',
      productName: 'Kit Ramen',
      variantName: '2 personas',
      sku: 'RAM-2',
      imageUrl: '/demo/products/ramen-1.jpg',
      unitPriceCents: 3500,
      compareAtPriceCents: null,
      requestedQuantity: 2,
      quantity: 2,
      availableQuantity: 10,
      lineTotalCents: 7000,
      taxRateBps: 1000,
      status: 'ok',
      message: null,
    },
  ],
  itemCount: 2,
  subtotalCents: 7000,
  discountCents: 700,
  shippingCents: 0,
  taxCents: 573,
  taxes: [{ rateBps: 1000, amountCents: 573 }],
  totalCents: 6300,
  freeShippingRemainingCents: 0,
  promotion: { code: 'BIENVENIDA10', applied: true, discountCents: 700, message: '', promotionId: 'promo-1' },
  isClean: true,
  isPurchasable: true,
  ...over,
})

const input: CheckoutInput = {
  items: [{ variantId: V, quantity: 2 }],
  promoCode: 'BIENVENIDA10',
  email: 'lucia@example.com',
  address: { fullName: 'Lucía', phone: undefined, line1: 'Calle Mayor 1', line2: undefined, city: 'Madrid', province: 'Madrid', postalCode: '28013', country: 'ES' },
  acceptTerms: true,
  newsletter: false,
  saveAddress: false,
}

function deps() {
  const orders = {
    createPendingOrder: vi.fn(async () => ({ id: 'order-1', number: 1001 })),
    attachCheckoutSession: vi.fn(async () => undefined),
    release: vi.fn(async () => 'cancelled'),
    saveAddress: vi.fn(),
    subscribeNewsletter: vi.fn(),
  }
  const stripe = {
    coupons: { create: vi.fn(async () => ({ id: 'co_1' })) },
    checkout: { sessions: { create: vi.fn(async () => ({ id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1', amount_total: 6300 })) } },
  }
  return { orders, stripe, deps: { orders: orders as unknown as OrdersService, stripe: stripe as unknown as Stripe } }
}

describe('startCheckout', () => {
  beforeEach(() => {
    quoteCart.mockReset()
    quoteCart.mockResolvedValue(quote())
  })

  it('crea el pedido y la sesión de Stripe con los importes del servidor', async () => {
    const { orders, stripe, deps: d } = deps()
    const result = await startCheckout(input, { userId: null, origin: 'https://tienda.test' }, d)
    expect(result).toEqual({ ok: true, url: 'https://checkout.stripe.com/c/pay/cs_1', orderId: 'order-1' })

    expect(orders.createPendingOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotalCents: 7000,
        discountCents: 700,
        totalCents: 6300,
        promotionId: 'promo-1',
        items: [{ variantId: V, quantity: 2, unitPriceCents: 3500 }],
      }),
    )
    expect(stripe.coupons.create).toHaveBeenCalledWith(expect.objectContaining({ amount_off: 700, max_redemptions: 1 }), { idempotencyKey: 'coupon-order-1' })

    const [params, options] = stripe.checkout.sessions.create.mock.calls[0] as unknown as [Stripe.Checkout.SessionCreateParams, Stripe.RequestOptions]
    expect(options).toEqual({ idempotencyKey: 'checkout-order-1' })
    expect(params.client_reference_id).toBe('order-1')
    expect(params.metadata).toEqual({ order_id: 'order-1', order_number: 'HDM-001001', locale: 'es' })
    expect(params.line_items?.[0]).toMatchObject({ quantity: 2, price_data: { unit_amount: 3500, currency: 'eur' } })
    expect(params.discounts).toEqual([{ coupon: 'co_1' }])
    expect(params.success_url).toBe('https://tienda.test/checkout/exito?session_id={CHECKOUT_SESSION_ID}')
    expect(params.cancel_url).toMatch(/^https:\/\/tienda\.test\/checkout\/cancelado\?pedido=order-1&t=/)
    expect(orders.attachCheckoutSession).toHaveBeenCalledWith('order-1', 'cs_1')
  })

  it('no crea nada si el carrito ha cambiado', async () => {
    quoteCart.mockResolvedValue(quote({ isClean: false }))
    const { orders, deps: d } = deps()
    const result = await startCheckout(input, { userId: null, origin: 'https://tienda.test' }, d)
    expect(result).toMatchObject({ ok: false, code: 'cart_changed' })
    expect(orders.createPendingOrder).not.toHaveBeenCalled()
  })

  it('no crea nada si el código promocional no es válido', async () => {
    quoteCart.mockResolvedValue(quote({ discountCents: 0, promotion: { code: 'X', applied: false, discountCents: 0, message: 'Este código ha caducado.', promotionId: null } }))
    const { orders, deps: d } = deps()
    const result = await startCheckout(input, { userId: null, origin: 'https://tienda.test' }, d)
    expect(result).toMatchObject({ ok: false, code: 'promotion_invalid', message: 'Este código ha caducado.' })
    expect(orders.createPendingOrder).not.toHaveBeenCalled()
  })

  it('devuelve un mensaje claro si la base de datos rechaza el pedido (sin stock)', async () => {
    const { orders, deps: d } = deps()
    orders.createPendingOrder.mockRejectedValueOnce(new OrderError('insufficient_stock', 'Alguien se te ha adelantado'))
    const result = await startCheckout(input, { userId: null, origin: 'https://tienda.test' }, d)
    expect(result).toMatchObject({ ok: false, code: 'insufficient_stock' })
  })

  it('cancela el pedido y libera el stock si Stripe falla', async () => {
    const { orders, stripe, deps: d } = deps()
    stripe.checkout.sessions.create.mockRejectedValueOnce(new Error('Stripe caído'))
    const result = await startCheckout(input, { userId: null, origin: 'https://tienda.test' }, d)
    expect(result).toMatchObject({ ok: false, code: 'payment_error' })
    expect(orders.release).toHaveBeenCalledWith('order-1', 'cancelled', expect.any(String))
  })

  it('cancela si Stripe calcula un total distinto al del pedido', async () => {
    const { orders, stripe, deps: d } = deps()
    stripe.checkout.sessions.create.mockResolvedValueOnce({ id: 'cs_1', url: 'https://x', amount_total: 1 })
    const result = await startCheckout(input, { userId: null, origin: 'https://tienda.test' }, d)
    expect(result.ok).toBe(false)
    expect(orders.release).toHaveBeenCalled()
    expect(orders.attachCheckoutSession).not.toHaveBeenCalled()
  })
})
