import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonClass } from '@/components/ui/button'
import { isStripeConfigured } from '@/lib/env'
import { getI18n } from '@/lib/i18n/server'
import { createOrdersService } from '@/lib/orders/service'
import { verifyOrderToken } from '@/lib/orders/token'
import { getStripe } from '@/lib/stripe/client'
import { isServiceRoleConfigured } from '@/lib/supabase/service'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t({ es: 'Pago cancelado', en: 'Payment cancelled' }), robots: { index: false } }
}
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function CancelledPage({ searchParams }: { searchParams: Promise<{ pedido?: string; t?: string }> }) {
  const { pedido, t: token } = await searchParams
  const { t } = await getI18n()

  // Libera el stock reservado al momento, en vez de esperar a que caduque la
  // sesión. El token firmado impide cancelar pedidos ajenos.
  if (pedido && UUID.test(pedido) && isStripeConfigured() && isServiceRoleConfigured() && verifyOrderToken(pedido, token)) {
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
      <p className="eyebrow">{t({ es: 'Pago cancelado', en: 'Payment cancelled' })}</p>
      <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{t({ es: 'No pasa nada.', en: 'No worries.' })}</h1>
      <p className="mt-4 text-lg text-ash-ink">
        {t({
          es: 'No se ha hecho ningún cargo. Tu cesta sigue tal cual por si quieres intentarlo de nuevo.',
          en: "You haven't been charged. Your bag is just as you left it if you want to try again.",
        })}
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/cesta" className={buttonClass('primary', 'lg')}>
          {t({ es: 'Volver a la cesta', en: 'Back to bag' })}
        </Link>
        <Link href="/tienda" className={buttonClass('secondary', 'lg')}>
          {t({ es: 'Seguir mirando', en: 'Keep browsing' })}
        </Link>
      </div>
    </div>
  )
}
