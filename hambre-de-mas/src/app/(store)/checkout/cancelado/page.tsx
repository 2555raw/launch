import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonClass } from '@/components/ui/button'
import { isStripeConfigured } from '@/lib/env'
import { createOrdersService } from '@/lib/orders/service'
import { verifyOrderToken } from '@/lib/orders/token'
import { getStripe } from '@/lib/stripe/client'
import { isServiceRoleConfigured } from '@/lib/supabase/service'

export const metadata: Metadata = { title: 'Pago cancelado', robots: { index: false } }
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function CancelledPage({ searchParams }: { searchParams: Promise<{ pedido?: string; t?: string }> }) {
  const { pedido, t } = await searchParams

  // Libera el stock reservado al momento, en vez de esperar a que caduque la
  // sesión. El token firmado impide cancelar pedidos ajenos.
  if (pedido && UUID.test(pedido) && isStripeConfigured() && isServiceRoleConfigured() && verifyOrderToken(pedido, t)) {
    try {
      const orders = createOrdersService()
      const order = await orders.getById(pedido)
      if (order?.status === 'pending') {
        if (order.stripeCheckoutSessionId) {
          await getStripe()
            .checkout.sessions.expire(order.stripeCheckoutSessionId)
            .catch(() => undefined)
        }
        await orders.release(order.id, 'cancelled', 'El cliente volvió sin pagar')
      }
    } catch (error) {
      console.error('[checkout/cancelado]', error)
    }
  }

  return (
    <div className="container-page max-w-2xl py-24 text-center">
      <p className="eyebrow">Pago cancelado</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">No pasa nada.</h1>
      <p className="mt-4 text-lg text-ash-ink">No se ha hecho ningún cargo. Tu cesta sigue tal cual por si quieres intentarlo de nuevo.</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/cesta" className={buttonClass('primary', 'lg')}>
          Volver a la cesta
        </Link>
        <Link href="/tienda" className={buttonClass('secondary', 'lg')}>
          Seguir mirando
        </Link>
      </div>
    </div>
  )
}
