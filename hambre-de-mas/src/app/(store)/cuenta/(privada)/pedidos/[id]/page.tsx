import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { OrderStatusBadge, OrderTimeline } from '@/components/account/order-status'
import { ProductImage } from '@/components/ui/product-image'
import { requireUser } from '@/lib/auth/session'
import { formatPrice } from '@/lib/money'
import { ORDER_SELECT, formatOrderNumber, mapOrder } from '@/lib/orders/mapper'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Pedido', robots: { index: false } }

const UUID = /^[0-9a-f-]{36}$/i

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireUser(`/cuenta/pedidos/${id}`)
  if (!UUID.test(id)) notFound()
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle()
  if (!data) notFound()
  const order = mapOrder(data)
  const a = order.shippingAddress

  return (
    <article aria-labelledby="pedido">
      <Link href="/cuenta/pedidos" className="text-sm text-teja hover:underline">
        ← Mis pedidos
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="pedido" className="font-display text-3xl font-bold">
            {formatOrderNumber(order.number)}
          </h2>
          <p className="text-sm text-ash-ink">Realizado el {new Date(order.createdAt).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}</p>
        </div>
        <OrderStatusBadge status={order.status} fulfillment={order.fulfillmentStatus} />
      </div>

      {order.status === 'paid' && <OrderTimeline fulfillment={order.fulfillmentStatus} />}

      {order.trackingNumber && (
        <p className="mt-6 rounded-2xl bg-mist px-5 py-4 text-sm">
          Seguimiento{order.trackingCarrier ? ` (${order.trackingCarrier})` : ''}: <strong>{order.trackingNumber}</strong>{' '}
          {order.trackingUrl && (
            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-teja hover:underline">
              Seguir envío
            </a>
          )}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
        <ul className="divide-y divide-line border-y border-line">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 py-4">
              <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-mist">
                {item.imageUrl && <ProductImage src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />}
              </span>
              <span className="flex-1 text-sm">
                {item.productSlug ? (
                  <Link href={`/producto/${item.productSlug}`} className="block font-semibold hover:text-teja">
                    {item.productName}
                  </Link>
                ) : (
                  <span className="block font-semibold">{item.productName}</span>
                )}
                <span className="block text-ash-ink">
                  {item.variantName} · {item.quantity} × {formatPrice(item.unitPriceCents)}
                </span>
              </span>
              <span className="text-sm font-medium tabular-nums">{formatPrice(item.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-6">
          <dl className="space-y-2 rounded-[22px] bg-mist p-5 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatPrice(order.subtotalCents)}</dd>
            </div>
            {order.discountCents > 0 && (
              <div className="flex justify-between">
                <dt>Descuento {order.promotionCode && `(${order.promotionCode})`}</dt>
                <dd className="text-hoja-ink tabular-nums">−{formatPrice(order.discountCents)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Envío</dt>
              <dd className="tabular-nums">{order.shippingCents ? formatPrice(order.shippingCents) : 'Gratis'}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPrice(order.totalCents)}</dd>
            </div>
            <p className="text-xs text-ash-ink">IVA incluido: {formatPrice(order.taxCents)}</p>
          </dl>
          <div className="text-sm">
            <h3 className="mb-1 font-semibold">Dirección de envío</h3>
            <p className="text-ash-ink">
              {a.fullName}
              <br />
              {a.line1}
              {a.line2 && (
                <>
                  <br />
                  {a.line2}
                </>
              )}
              <br />
              {a.postalCode} {a.city} ({a.province})
            </p>
          </div>
          <p className="text-xs text-ash-ink">
            ¿Algún problema con el pedido?{' '}
            <Link href="/contacto" className="text-teja hover:underline">
              Escríbenos
            </Link>{' '}
            indicando el número {formatOrderNumber(order.number)}.
          </p>
        </div>
      </div>
    </article>
  )
}
