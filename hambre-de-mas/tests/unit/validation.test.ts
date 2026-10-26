import { describe, expect, it } from 'vitest'
import { isShippablePostalCode } from '@/lib/config/commerce'
import { cartRequestSchema, checkoutSchema, productInputSchema } from '@/lib/validation/schemas'

const base = {
  items: [{ variantId: '11111111-1111-4111-8111-111111111111', quantity: 1 }],
  email: '  Lucia@Example.COM ',
  address: { fullName: 'Lucía', line1: 'Calle Mayor 1', city: 'Madrid', province: 'Madrid', postalCode: '28013', country: 'ES' },
  acceptTerms: true,
}

describe('códigos postales', () => {
  it('acepta Península y Baleares', () => {
    expect(isShippablePostalCode('28013')).toBe(true)
    expect(isShippablePostalCode('07001')).toBe(true)
  })
  it('rechaza Canarias, Ceuta, Melilla y códigos inválidos', () => {
    for (const cp of ['35001', '38001', '51001', '52001', '00000', '53000', '2801', 'abcde']) expect(isShippablePostalCode(cp)).toBe(false)
  })
})

describe('checkoutSchema', () => {
  it('normaliza el email y acepta un pedido válido', () => {
    const r = checkoutSchema.safeParse(base)
    expect(r.success).toBe(true)
    expect(r.data?.email).toBe('lucia@example.com')
  })

  it('exige aceptar las condiciones', () => {
    const r = checkoutSchema.safeParse({ ...base, acceptTerms: false })
    expect(r.success).toBe(false)
  })

  it('ignora cualquier precio que mande el navegador', () => {
    const r = checkoutSchema.safeParse({ ...base, items: [{ ...base.items[0], priceCents: 1 }], totalCents: 1 })
    expect(r.success).toBe(true)
    expect(JSON.stringify(r.data)).not.toContain('priceCents')
    expect(JSON.stringify(r.data)).not.toContain('totalCents')
  })

  it('rechaza ids que no son UUID y cantidades fuera de rango', () => {
    expect(checkoutSchema.safeParse({ ...base, items: [{ variantId: '1; drop table', quantity: 1 }] }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...base, items: [{ variantId: base.items[0]!.variantId, quantity: 0 }] }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...base, items: [{ variantId: base.items[0]!.variantId, quantity: 100 }] }).success).toBe(false)
  })

  it('rechaza envíos fuera de zona con un mensaje claro', () => {
    const r = checkoutSchema.safeParse({ ...base, address: { ...base.address, postalCode: '35001' } })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toMatch(/Península y Baleares/)
  })
})

describe('cartRequestSchema', () => {
  it('pasa los códigos a mayúsculas y rechaza caracteres raros', () => {
    expect(cartRequestSchema.parse({ items: [], promoCode: ' hambre5 ' }).promoCode).toBe('HAMBRE5')
    expect(cartRequestSchema.safeParse({ items: [], promoCode: "X' OR 1=1" }).success).toBe(false)
  })
})

describe('productInputSchema', () => {
  const product = {
    name: 'Kit',
    slug: 'kit-nuevo',
    status: 'draft',
    taxRateBps: 1000,
    variants: [{ sku: 'A', name: '2 personas', price: '12.5', compareAt: '', stock: '3', isActive: true }],
  }
  it('convierte euros a céntimos', () => {
    const r = productInputSchema.parse(product)
    expect(r.variants[0]).toMatchObject({ price: 1250, compareAt: null, stock: 3 })
  })
  it('exige que el precio anterior sea mayor', () => {
    expect(productInputSchema.safeParse({ ...product, variants: [{ ...product.variants[0], compareAt: '10' }] }).success).toBe(false)
  })
  it('rechaza precios por debajo del mínimo de Stripe y slugs inválidos', () => {
    expect(productInputSchema.safeParse({ ...product, variants: [{ ...product.variants[0], price: '0.2' }] }).success).toBe(false)
    expect(productInputSchema.safeParse({ ...product, slug: 'Kit Nuevo!' }).success).toBe(false)
  })
})
