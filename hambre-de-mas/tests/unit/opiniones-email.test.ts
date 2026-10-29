import { describe, expect, it } from 'vitest'
import { buildReviewRequestEmail } from '@/lib/email/review-request'
import type { Order, OrderItem } from '@/lib/types'

const item = (slug: string, name: string): OrderItem =>
  ({ id: slug, productId: 'p', variantId: 'v', productName: name, productSlug: slug, variantName: '2 personas', sku: 'S', imageUrl: null, unitPriceCents: 1000, quantity: 1, lineTotalCents: 1000 }) as unknown as OrderItem

const order = (over: Partial<Order> = {}): Order =>
  ({
    id: 'o1',
    number: 1042,
    email: 'lucia@example.com',
    customerName: 'Lucía García',
    locale: 'es',
    items: [item('kit-ramen-casero', 'Kit Ramen casero'), item('kit-ramen-casero', 'Kit Ramen casero'), item('kit-tacos-al-pastor', 'Kit Tacos al pastor')],
    ...over,
  }) as Order

describe('email que pide opinión', () => {
  it('enlaza una vez a la sección de opiniones de cada kit del pedido', () => {
    const email = buildReviewRequestEmail(order())
    expect(email.to).toBe('lucia@example.com')
    expect(email.subject).toBe('¿Qué tal te ha salido, Lucía?')
    expect(email.text.match(/\/producto\/kit-ramen-casero#opiniones/g)).toHaveLength(1)
    expect(email.text).toContain('/producto/kit-tacos-al-pastor#opiniones')
    expect(email.html).toContain('HDM-001042')
  })

  it('va en el idioma en el que se compró', () => {
    expect(buildReviewRequestEmail(order({ locale: 'en' })).subject).toBe('How did it turn out, Lucía?')
  })
})
