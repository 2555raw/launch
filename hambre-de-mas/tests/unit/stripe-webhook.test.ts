import Stripe from 'stripe'
import { describe, expect, it, vi } from 'vitest'
import type { OrdersService } from '@/lib/orders/service'
import { handleStripeEvent } from '@/lib/stripe/webhook'

vi.mock('@/lib/email/order-confirmation', () => ({ sendOrderConfirmation: vi.fn(async () => ({ sent: false })) }))

function fakeOrders(overrides: Partial<Record<keyof OrdersService, unknown>> = {}) {
  return {
    markPaid: vi.fn(async () => 'paid'),
    release: vi.fn(async (_id: string, status: string) => status),
    extendReservation: vi.fn(async () => undefined),
    markRefunded: vi.fn(async () => 'refunded'),
    getById: vi.fn(async () => null),
    ...overrides,
  } as unknown as OrdersService & Record<string, ReturnType<typeof vi.fn>>
}

const session = (over: Record<string, unknown> = {}) =>
  ({
    id: 'cs_test_123',
    object: 'checkout.session',
    payment_status: 'paid',
    status: 'complete',
    amount_total: 6300,
    currency: 'eur',
    payment_intent: 'pi_123',
    client_reference_id: 'order-uuid',
    metadata: { order_id: 'order-uuid' },
    ...over,
  }) as unknown as Stripe.Checkout.Session

const event = (type: string, object: unknown) => ({ id: 'evt_1', type, data: { object } }) as unknown as Stripe.Event

describe('handleStripeEvent', () => {
  it('marca el pedido como pagado con los datos de Stripe', async () => {
    const orders = fakeOrders()
    const out = await handleStripeEvent(event('checkout.session.completed', session()), orders)
    expect(out).toMatchObject({ handled: true, result: 'paid', orderId: 'order-uuid' })
    expect(orders.markPaid).toHaveBeenCalledWith({
      orderId: 'order-uuid',
      sessionId: 'cs_test_123',
      paymentIntentId: 'pi_123',
      amountTotal: 6300,
      currency: 'eur',
    })
  })

  it('no marca como pagado un pago diferido todavía sin confirmar', async () => {
    const orders = fakeOrders()
    const out = await handleStripeEvent(event('checkout.session.completed', session({ payment_status: 'unpaid' })), orders)
    expect(out.result).toBe('awaiting_payment')
    expect(orders.markPaid).not.toHaveBeenCalled()
    expect(orders.extendReservation).toHaveBeenCalled()
  })

  it('confirma los pagos diferidos cuando Stripe avisa', async () => {
    const orders = fakeOrders()
    await handleStripeEvent(event('checkout.session.async_payment_succeeded', session()), orders)
    expect(orders.markPaid).toHaveBeenCalledOnce()
  })

  it('libera el stock si la sesión caduca o el pago diferido falla', async () => {
    const orders = fakeOrders()
    await handleStripeEvent(event('checkout.session.expired', session({ status: 'expired', payment_status: 'unpaid' })), orders)
    await handleStripeEvent(event('checkout.session.async_payment_failed', session()), orders)
    expect(orders.release).toHaveBeenNthCalledWith(1, 'order-uuid', 'expired', expect.any(String))
    expect(orders.release).toHaveBeenNthCalledWith(2, 'order-uuid', 'cancelled', expect.any(String))
  })

  it('registra reembolsos totales', async () => {
    const orders = fakeOrders()
    await handleStripeEvent(event('charge.refunded', { payment_intent: 'pi_123', amount_refunded: 6300, refunded: true }), orders)
    expect(orders.markRefunded).toHaveBeenCalledWith('pi_123', 6300, true)
  })

  it('ignora eventos que no le interesan y sesiones sin pedido', async () => {
    const orders = fakeOrders()
    expect(await handleStripeEvent(event('customer.created', {}), orders)).toEqual({ handled: false })
    expect((await handleStripeEvent(event('checkout.session.completed', session({ metadata: {}, client_reference_id: null })), orders)).handled).toBe(false)
    expect(orders.markPaid).not.toHaveBeenCalled()
  })
})

describe('firma de webhooks', () => {
  const stripe = new Stripe('sk_test_dummy')
  const secret = 'whsec_test_secret'
  const payload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'checkout.session.completed', data: { object: {} } })

  it('acepta un evento firmado con el secreto correcto', () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret })
    expect(stripe.webhooks.constructEvent(payload, header, secret).id).toBe('evt_1')
  })

  it('rechaza un cuerpo manipulado o firmado con otro secreto', () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret })
    expect(() => stripe.webhooks.constructEvent(payload.replace('evt_1', 'evt_2'), header, secret)).toThrow()
    const other = stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_otro' })
    expect(() => stripe.webhooks.constructEvent(payload, other, secret)).toThrow()
  })
})
