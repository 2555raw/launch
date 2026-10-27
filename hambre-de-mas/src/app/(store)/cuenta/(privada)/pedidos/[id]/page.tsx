import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { OrderStatusBadge, OrderTimeline } from '@/components/account/order-status'
import { ProductImage } from '@/components/ui/product-image'
import { requireUser } from '@/lib/auth/session'
import { getI18n } from '@/lib/i18n/server'
import { formatDate, formatPrice } from '@/lib/money'
import { ORDER_SELECT, formatOrderNumber, mapOrder } from '@/lib/orders/mapper'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t({ es: 'Pedido', en: 'Order' }), robots: { index: false } }
}

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
  const { locale, t } = await getI18n()
  const price = (cents: number) => formatPrice(cents, locale)

  return (
    <article aria-labelledby="pedido">
      <Link href="/cuenta/pedidos" className="text-sm text-teja hover:underline">
        ← {t({ es: 'Mis pedidos', en: 'My orders' })}
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="pedido" className="font-display text-3xl font-bold">
            {formatOrderNumber(order.number)}
          </h2>
          <p className="text-sm text-ash-ink">
            {t({ es: 'Realizado el', en: 'Placed on' })} {formatDate(order.createdAt, locale, { dateStyle: 'long', timeStyle: 'short' })}
          </p>
        </div>
        <OrderStatusBadge status={order.status} fulfillment={order.fulfillmentStatus} />
      </div>

      {order.status === 'paid' && <OrderTimeline fulfillment={order.fulfillmentStatus} />}

      {order.trackingNumber && (
        <p className="mt-6 rounded-2xl bg-mist px-5 py-4 text-sm">
          {t({ es: 'Seguimiento', en: 'Tracking' })}
          {order.trackingCarrier ? ` (${order.trackingCarrier})` : ''}: <strong>{order.trackingNumber}</strong>{' '}
          {order.trackingUrl && (
            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-teja hover:underline">
              {t({ es: 'Seguir envío', en: 'Track parcel' })}
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
                  {item.variantName} · {item.quantity} × {price(item.unitPriceCents)}
                </span>
              </span>
              <span className="text-sm font-medium tabular-nums">{price(item.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-6">
          <dl className="space-y-2 rounded-[22px] bg-mist p-5 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{price(order.subtotalCents)}</dd>
            </div>
            {order.discountCents > 0 && (
              <div className="flex justify-between">
                <dt>
                  {t({ es: 'Descuento', en: 'Discount' })} {order.promotionCode && `(${order.promotionCode})`}
                </dt>
                <dd className="text-hoja-ink tabular-nums">−{price(order.discountCents)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>{t({ es: 'Envío', en: 'Shipping' })}</dt>
              <dd className="tabular-nums">{order.shippingCents ? price(order.shippingCents) : t({ es: 'Gratis', en: 'Free' })}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{price(order.totalCents)}</dd>
            </div>
            <p className="text-xs text-ash-ink">
              {t({ es: 'IVA incluido', en: 'VAT included' })}: {price(order.taxCents)}
            </p>
          </dl>
          <div className="text-sm">
            <h3 className="mb-1 font-semibold">{t({ es: 'Dirección de envío', en: 'Delivery address' })}</h3>
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
            {t({ es: '¿Algún problema con el pedido?', en: 'Any problem with your order?' })}{' '}
            <Link href="/contacto" className="text-teja hover:underline">
              {t({ es: 'Escríbenos', en: 'Write to us' })}
            </Link>{' '}
            {t({ es: 'indicando el número', en: 'quoting number' })} {formatOrderNumber(order.number)}.
          </p>
        </div>
      </div>
    </article>
  )
}
