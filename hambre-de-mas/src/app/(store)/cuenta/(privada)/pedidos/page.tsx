import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonClass } from '@/components/ui/button'
import { ChevronRightIcon } from '@/components/ui/icons'
import { OrderStatusBadge } from '@/components/account/order-status'
import { requireUser } from '@/lib/auth/session'
import { getI18n } from '@/lib/i18n/server'
import { formatDate, formatPrice } from '@/lib/money'
import { ORDER_SELECT, formatOrderNumber, mapOrder } from '@/lib/orders/mapper'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t({ es: 'Mis pedidos', en: 'My orders' }), robots: { index: false } }
}

export default async function OrdersPage() {
  const user = await requireUser('/cuenta/pedidos')
  const supabase = await createSupabaseServerClient()
  // RLS: aunque quitáramos el filtro, solo vendrían los pedidos de este usuario.
  const { data } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('user_id', user.id)
    .neq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)
  const orders = (data ?? []).map(mapOrder)
  const { locale, t } = await getI18n()

  return (
    <section aria-labelledby="pedidos">
      <h2 id="pedidos" className="font-display text-2xl font-bold">
        {t({ es: 'Mis pedidos', en: 'My orders' })}
      </h2>
      {orders.length === 0 ? (
        <div className="mt-6 rounded-[24px] bg-mist p-10 text-center">
          <p className="font-semibold">{t({ es: 'Todavía no has hecho ningún pedido.', en: "You haven't placed any orders yet." })}</p>
          <Link href="/tienda" className={buttonClass('primary', 'md', 'mt-5')}>
            {t({ es: 'Ver los kits', en: 'Browse kits' })}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/cuenta/pedidos/${o.id}`} className="group flex flex-wrap items-center gap-x-6 gap-y-2 py-5">
                <span className="min-w-36">
                  <span className="block font-semibold">{formatOrderNumber(o.number)}</span>
                  <span className="block text-sm text-ash-ink">{formatDate(o.createdAt, locale)}</span>
                </span>
                <span className="flex-1 text-sm text-ash-ink">
                  {o.items.reduce((s, i) => s + i.quantity, 0)} {t({ es: 'productos', en: 'items' })} · {o.items.map((i) => i.productName).slice(0, 2).join(', ')}
                  {o.items.length > 2 ? '…' : ''}
                </span>
                <OrderStatusBadge status={o.status} fulfillment={o.fulfillmentStatus} />
                <span className="w-24 text-right font-semibold tabular-nums">{formatPrice(o.totalCents, locale)}</span>
                <ChevronRightIcon size={18} className="text-ash transition-transform group-hover:translate-x-1" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
