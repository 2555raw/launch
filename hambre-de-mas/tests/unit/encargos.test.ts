import { describe, expect, it } from 'vitest'
import { demoProducts } from '@/data/demo-catalog'
import { computeQuote, type QuoteConfig } from '@/lib/pricing/quote'
import { dayLabel, isPreorder, isPreorderOpen } from '@/lib/preorder'
import type { VariantForQuote } from '@/lib/types'

const config: QuoteConfig = { shippingCents: 495, freeShippingThresholdCents: 4000, shippingTaxRateBps: 2100, maxQuantityPerLine: 10 }

const variant: VariantForQuote = {
  variantId: '11111111-1111-4111-8111-111111111111',
  sku: 'HDM-NAV-2',
  variantName: '2 personas',
  priceCents: 4990,
  compareAtPriceCents: null,
  stock: 40,
  isActive: true,
  productId: 'p1',
  productSlug: 'caja-sobremesa-navidad',
  productName: 'Caja Sobremesa',
  productPublished: true,
  taxRateBps: 1000,
  imageUrl: null,
  preorderRelease: '2026-12-25',
}

describe('ediciones por encargo', () => {
  it('solo se encargan hasta el día de salida (hora peninsular)', () => {
    const attrs = { preorder: { releaseDate: '2026-12-25' } }
    expect(isPreorder(attrs, new Date('2026-12-24T22:59:00Z'))).toBe(true)
    expect(isPreorder(attrs, new Date('2026-12-24T23:00:00Z'))).toBe(false)
    expect(isPreorder({}, new Date('2026-01-01'))).toBe(false)
  })

  it('los encargos se cierran al acabar el último día, aunque aún no se pueda comprar', () => {
    const attrs = { preorder: { releaseDate: '2026-12-25', closesDate: '2026-12-10' } }
    expect(isPreorderOpen(attrs, new Date('2026-12-10T22:59:00Z'))).toBe(true)
    expect(isPreorderOpen(attrs, new Date('2026-12-10T23:00:00Z'))).toBe(false)
    expect(isPreorder(attrs, new Date('2026-12-10T23:00:00Z'))).toBe(true)
  })

  it('no se pueden pagar aunque alguien las meta en la cesta', () => {
    const q = computeQuote({ requested: [{ variantId: variant.variantId, quantity: 1 }], variants: [variant], config })
    expect(q.lines[0]?.status).toBe('unavailable')
    expect(q.lines[0]?.quantity).toBe(0)
    expect(q.isPurchasable).toBe(false)
  })

  it('la caja de Navidad sale el 25 de diciembre', () => {
    const box = demoProducts.find((p) => p.slug === 'caja-sobremesa-navidad')
    expect(box?.category).toBe('caja-sorpresa')
    expect(box?.attributes.preorder?.releaseDate).toBe('2026-12-25')
    expect(box?.attributes.preorder?.closesDate).toBe('2026-12-10')
    expect(dayLabel('2026-12-25', 'es')).toBe('25 de diciembre')
    expect(dayLabel('2026-12-25', 'en')).toBe('25 December')
  })
})
