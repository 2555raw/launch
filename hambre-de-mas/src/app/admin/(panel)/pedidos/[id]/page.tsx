import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cancelPendingOrder } from '@/app/actions/admin'
import { OrderStatusBadge } from '@/components/account/order-status'
import { FulfillmentForm, RefundButton } from '@/components/admin/order-actions'
import { AdminHeader, Card } from '@/components/admin/ui'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/money'
import { ORDER_SELECT, formatOrderNumber, mapOrder } from '@/lib/orders/mapper'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = { title: 'Pedido' }

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createSupabaseServerClient()
  const [{ data }, { data: events }] = await Promise.all([
    supabase.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle(),
    supabase.from('order_events').select('*').eq('order_id', id).order('created_at'),
  ])
  if (!data) notFound()
  const order = mapOrder(data)
  const a = order.shippingAddress

  return (
    <>
      <Link href="/admin/pedidos" className="text-sm text-teja hover:underline">
        ← Pedidos
      </Link>
      <AdminHeader
        title={formatOrderNumber(order.number)}
        description={`${new Date(order.createdAt).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })} · ${order.email}`}
        actions={<OrderStatusBadge status={order.status} fulfillment={order.fulfillmentStatus} />}
      />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title="Productos">
            <ul className="divide-y divide-line text-sm">
              {order.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 py-3">
                  <span>
                    <span className="block font-medium">{i.productName}</span>
                    <span className="block text-ash-ink">
                      {i.variantName} · SKU {i.sku} · {i.quantity} × {formatPrice(i.unitPriceCents)}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatPrice(i.lineTotalCents)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatPrice(order.subtotalCents)}</dd></div>
              {order.discountCents > 0 && (
                <div className="flex justify-between"><dt>Descuento ({order.promotionCode})</dt><dd className="tabular-nums">−{formatPrice(order.discountCents)}</dd></div>
              )}
              <div className="flex justify-between"><dt>Envío</dt><dd className="tabular-nums">{formatPrice(order.shippingCents)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total cobrado</dt><dd className="tabular-nums">{formatPrice(order.totalCents)}</dd></div>
              <div className="flex justify-between text-ash-ink"><dt>IVA incluido</dt><dd className="tabular-nums">{formatPrice(order.taxCents)}</dd></div>
            </dl>
          </Card>
          <Card title="Historial">
            <ol className="space-y-3 text-sm">
              {(events ?? []).map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-chef" aria-hidden />
                  <span>
                    <span className="block">{e.message}</span>
                    <span className="block text-xs text-ash-ink">{new Date(e.created_at).toLocaleString('es-ES')}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Cliente y envío">
            <p className="text-sm">
              {a.fullName}
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ''}
              <br />
              {a.postalCode} {a.city} ({a.province})
              <br />
              {order.phone && <>Tel. {order.phone}<br /></>}
              <a href={`mailto:${order.email}`} className="text-teja hover:underline">{order.email}</a>
            </p>
            <p className="mt-3 text-xs text-ash-ink">{order.userId ? 'Cliente registrado' : 'Compra como invitado'}</p>
          </Card>
          {order.status === 'paid' && (
            <Card title="Envío">
              <FulfillmentForm order={order} />
            </Card>
          )}
          <Card title="Pago">
            <p className="text-sm text-ash-ink">
              Stripe: {order.stripePaymentIntentId ?? 'sin PaymentIntent'}
              {order.paidAt && <><br />Pagado el {new Date(order.paidAt).toLocaleString('es-ES')}</>}
            </p>
            <div className="mt-4 space-y-3">
              {order.status === 'pending' && (
                <form action={cancelPendingOrder}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <Button variant="secondary" size="sm">Cancelar y liberar stock</Button>
                </form>
              )}
              {(order.status === 'paid' || order.status === 'requires_review') && order.stripePaymentIntentId && <RefundButton orderId={order.id} />}
              {order.status === 'requires_review' && (
                <p className="rounded-xl bg-almendra-soft px-3 py-2 text-xs text-teja">
                  Revisa el historial: el pago no cuadraba con el pedido o llegó tras cancelarlo. Comprueba el stock antes de enviarlo o reembolsa.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
