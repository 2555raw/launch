import { describe, expect, it } from 'vitest'
import { availabilityOf, breadcrumbLd, productLd } from '@/lib/seo'
import type { ProductDetail } from '@/lib/types'

const product = (over: Partial<ProductDetail> = {}) =>
  ({
    slug: 'caja-sobremesa-navidad',
    name: 'Caja Sobremesa',
    subtitle: 'Edición Navidad',
    description: '',
    images: [{ id: '1', url: '/demo/products/navidad-1.jpg', alt: '', position: 0 }],
    category: { slug: 'caja-sorpresa', name: 'Caja sorpresa', level: null, accent: 'almendra' },
    attributes: { preorder: { releaseDate: '2026-12-25', closesDate: '2026-12-10' } },
    variants: [{ id: 'v1', sku: 'HDM-NAV-2', name: '2 personas', priceCents: 4990, compareAtPriceCents: null, stock: 40, isActive: true, position: 0 }],
    ...over,
  }) as unknown as ProductDetail

describe('datos estructurados', () => {
  it('las ediciones por encargo salen como PreOrder con su fecha, y agotadas al cerrar el plazo', () => {
    expect(availabilityOf(product(), 40, new Date('2026-11-02'))).toBe('PreOrder')
    expect(availabilityOf(product(), 40, new Date('2026-12-12'))).toBe('OutOfStock')
    expect(availabilityOf(product({ attributes: {} }), 0)).toBe('OutOfStock')
    expect(availabilityOf(product({ attributes: {} }), 3)).toBe('InStock')
  })

  it('la ficha lleva envío y devoluciones, y la valoración solo si es real', () => {
    const ld = productLd(product({ attributes: {} }), null) as Record<string, unknown> & { offers: Record<string, unknown>[] }
    expect(ld.offers[0]?.shippingDetails).toBeTruthy()
    expect(ld.offers[0]?.hasMerchantReturnPolicy).toBeTruthy()
    expect(ld.aggregateRating).toBeUndefined()
    expect((productLd(product({ attributes: {} }), { average: 4.6, count: 12 }) as Record<string, unknown>).aggregateRating).toMatchObject({ ratingValue: '4.6', reviewCount: 12 })
  })

  it('las migas de pan van numeradas y con URL absoluta', () => {
    const ld = breadcrumbLd([
      { name: 'Tienda', path: '/tienda' },
      { name: 'Kit', path: '/producto/kit' },
    ])
    expect(ld.itemListElement[1]).toMatchObject({ position: 2, name: 'Kit' })
    expect(String(ld.itemListElement[0]?.item)).toMatch(/^https?:\/\/.+\/tienda$/)
  })
})
