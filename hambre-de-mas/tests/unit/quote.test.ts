import { describe, expect, it } from 'vitest'
import { computeQuote, evaluatePromotion, normalizeRequest, type QuoteConfig } from '@/lib/pricing/quote'
import type { Promotion, VariantForQuote } from '@/lib/types'

const config: QuoteConfig = { shippingCents: 495, freeShippingThresholdCents: 4000, shippingTaxRateBps: 2100, maxQuantityPerLine: 10 }

const variant = (over: Partial<VariantForQuote> = {}): VariantForQuote => ({
  variantId: '11111111-1111-4111-8111-111111111111',
  sku: 'SKU-1',
  variantName: '2 personas',
  priceCents: 1690,
  compareAtPriceCents: null,
  stock: 20,
  isActive: true,
  productId: 'p1',
  productSlug: 'kit',
  productName: 'Kit',
  productPublished: true,
  taxRateBps: 1000,
  imageUrl: null,
  ...over,
})

const promo = (over: Partial<Promotion> = {}): Promotion => ({
  id: 'promo-1',
  code: 'BIENVENIDA10',
  description: '10 %',
  kind: 'percent',
  value: 10,
  minSubtotalCents: 2000,
  startsAt: null,
  endsAt: null,
  maxRedemptions: null,
  timesRedeemed: 0,
  isActive: true,
  ...over,
})

const V2 = '22222222-2222-4222-8222-222222222222'

describe('computeQuote', () => {
  it('usa siempre el precio del servidor y suma envío por debajo del umbral', () => {
    const q = computeQuote({ requested: [{ variantId: variant().variantId, quantity: 2 }], variants: [variant()], config })
    expect(q.subtotalCents).toBe(3380)
    expect(q.shippingCents).toBe(495)
    expect(q.totalCents).toBe(3875)
    expect(q.itemCount).toBe(2)
    expect(q.isClean).toBe(true)
    expect(q.isPurchasable).toBe(true)
  })

  it('calcula el IVA incluido por tipo, también el del envío', () => {
    const q = computeQuote({ requested: [{ variantId: variant().variantId, quantity: 1 }], variants: [variant({ priceCents: 1100 })], config })
    // 11,00 € con 10 % => 1,00 € de IVA; envío 4,95 € con 21 % => 0,86 €
    expect(q.taxes).toEqual([
      { rateBps: 1000, amountCents: 100 },
      { rateBps: 2100, amountCents: 86 },
    ])
    expect(q.taxCents).toBe(186)
  })

  it('el envío es gratis a partir del umbral', () => {
    const q = computeQuote({ requested: [{ variantId: variant().variantId, quantity: 3 }], variants: [variant()], config })
    expect(q.subtotalCents).toBe(5070)
    expect(q.shippingCents).toBe(0)
    expect(q.freeShippingRemainingCents).toBe(0)
  })

  it('el umbral de envío gratis se mide después del descuento', () => {
    const q = computeQuote({
      requested: [{ variantId: variant().variantId, quantity: 1 }],
      variants: [variant({ priceCents: 4200 })],
      promotion: promo(),
      promotionCode: 'bienvenida10',
      config,
    })
    expect(q.discountCents).toBe(420)
    expect(q.shippingCents).toBe(495)
    expect(q.totalCents).toBe(4200 - 420 + 495)
  })

  it('limita la cantidad al stock disponible y lo indica', () => {
    const q = computeQuote({ requested: [{ variantId: variant().variantId, quantity: 5 }], variants: [variant({ stock: 3 })], config })
    expect(q.lines[0]).toMatchObject({ quantity: 3, requestedQuantity: 5, status: 'adjusted', availableQuantity: 3 })
    expect(q.lines[0]?.message).toContain('3 unidades')
    expect(q.isClean).toBe(false)
    expect(q.subtotalCents).toBe(3 * 1690)
  })

  it('aplica el máximo de unidades por línea', () => {
    const q = computeQuote({ requested: [{ variantId: variant().variantId, quantity: 50 }], variants: [variant({ stock: 100 })], config })
    expect(q.lines[0]).toMatchObject({ quantity: 10, status: 'adjusted' })
  })

  it('marca como no disponible lo agotado, lo despublicado y lo inexistente', () => {
    const q = computeQuote({
      requested: [
        { variantId: variant().variantId, quantity: 1 },
        { variantId: V2, quantity: 1 },
        { variantId: '33333333-3333-4333-8333-333333333333', quantity: 1 },
      ],
      variants: [variant({ stock: 0 }), variant({ variantId: V2, productPublished: false })],
      config,
    })
    expect(q.lines.map((l) => l.status)).toEqual(['unavailable', 'unavailable', 'not_found'])
    expect(q.subtotalCents).toBe(0)
    expect(q.shippingCents).toBe(0)
    expect(q.isPurchasable).toBe(false)
  })

  it('junta líneas repetidas de la misma variante', () => {
    expect(
      normalizeRequest([
        { variantId: 'a', quantity: 1 },
        { variantId: 'a', quantity: 2 },
        { variantId: 'b', quantity: 0 },
        { variantId: 'c', quantity: Number.NaN },
      ]),
    ).toEqual([{ variantId: 'a', quantity: 3 }])
  })

  it('reparte el descuento entre tipos de IVA', () => {
    const q = computeQuote({
      requested: [
        { variantId: variant().variantId, quantity: 1 },
        { variantId: V2, quantity: 1 },
      ],
      variants: [variant({ priceCents: 3000 }), variant({ variantId: V2, priceCents: 3000, taxRateBps: 2100 })],
      promotion: promo({ kind: 'fixed', value: 1000, minSubtotalCents: 0 }),
      promotionCode: 'BIENVENIDA10',
      config,
    })
    expect(q.discountCents).toBe(1000)
    // 2500 € al 10 % y 2500 € al 21 %
    expect(q.taxes).toEqual([
      { rateBps: 1000, amountCents: 227 },
      { rateBps: 2100, amountCents: 434 },
    ])
  })
})

describe('evaluatePromotion', () => {
  const now = new Date('2026-10-26T12:00:00Z')

  it('aplica porcentajes y cantidades fijas', () => {
    expect(evaluatePromotion(promo(), 'X', 5000, now)).toMatchObject({ applied: true, discountCents: 500 })
    expect(evaluatePromotion(promo({ kind: 'fixed', value: 700, minSubtotalCents: 0 }), 'X', 5000, now)).toMatchObject({ applied: true, discountCents: 700 })
  })

  it('rechaza códigos inexistentes, inactivos, caducados o agotados', () => {
    expect(evaluatePromotion(null, 'NADA', 5000, now).applied).toBe(false)
    expect(evaluatePromotion(promo({ isActive: false }), 'X', 5000, now).applied).toBe(false)
    expect(evaluatePromotion(promo({ endsAt: '2026-10-01T00:00:00Z' }), 'X', 5000, now).message).toMatch(/caducado/)
    expect(evaluatePromotion(promo({ startsAt: '2026-11-01T00:00:00Z' }), 'X', 5000, now).message).toMatch(/todavía/)
    expect(evaluatePromotion(promo({ maxRedemptions: 5, timesRedeemed: 5 }), 'X', 5000, now).message).toMatch(/agotado/)
  })

  it('exige el pedido mínimo e indica cuánto falta', () => {
    const r = evaluatePromotion(promo({ minSubtotalCents: 2000 }), 'X', 1500, now)
    expect(r.applied).toBe(false)
    expect(r.message).toContain('5,00 €')
  })

  it('nunca deja el total por debajo del cobro mínimo de Stripe', () => {
    const r = evaluatePromotion(promo({ kind: 'fixed', value: 5000, minSubtotalCents: 0 }), 'X', 1000, now)
    expect(r.discountCents).toBe(950)
  })
})
