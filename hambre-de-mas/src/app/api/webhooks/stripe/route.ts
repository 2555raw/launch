import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { serverEnv } from '@/lib/env'
import { createOrdersService } from '@/lib/orders/service'
import { getStripe } from '@/lib/stripe/client'
import { handleStripeEvent } from '@/lib/stripe/webhook'

/**
 * Webhook de Stripe. Solo se procesa un evento si su firma es válida con
 * STRIPE_WEBHOOK_SECRET; el cuerpo se lee en crudo para poder verificarla.
 */
export async function POST(request: NextRequest) {
  const secret = serverEnv.stripeWebhookSecret()
  if (!secret || !serverEnv.stripeSecretKey()) {
    return NextResponse.json({ error: 'Stripe no está configurado' }, { status: 503 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Falta la firma' }, { status: 400 })

  const payload = await request.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret)
  } catch {
    return NextResponse.json({ error: 'Firma no válida' }, { status: 400 })
  }

  const orders = createOrdersService()
  try {
    if (await orders.hasProcessedEvent(event.id)) {
      return NextResponse.json({ received: true, duplicate: true })
    }
    const outcome = await handleStripeEvent(event, orders)
    await orders.recordEvent(event.id, event.type)
    return NextResponse.json({ received: true, ...outcome })
  } catch (error) {
    // 500 => Stripe reintentará más tarde. Todo el procesamiento es idempotente.
    console.error(`[webhook] error procesando ${event.type} ${event.id}`, error)
    return NextResponse.json({ error: 'Error procesando el evento' }, { status: 500 })
  }
}
