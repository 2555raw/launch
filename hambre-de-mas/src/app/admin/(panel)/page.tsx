import Link from 'next/link'
import { OrderStatusBadge } from '@/components/account/order-status'
import { AdminHeader, Card, Stat, table } from '@/components/admin/ui'
import { formatPrice } from '@/lib/money'
import { formatOrderNumber } from '@/lib/orders/mapper'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = { title: 'Resumen' }

type Stats = {
  revenue_total_cents: number
  revenue_30d_cents: number
  orders_paid: number
  orders_30d: number
  orders_pending: number
  orders_to_ship: number
  orders_review: number
  customers: number
  products_published: number
  low_stock: number
  reviews_pending: number
  daily: { day: string; revenue_cents: number; orders: number }[]
  top_products: { name: string; slug: string; sales_count: number }[]
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const [{ data: stats, error }, { data: recent }, { data: lowStock }] = await Promise.all([
    supabase.rpc('admin_dashboard_stats'),
    supabase
      .from('orders')
      .select('id, number, customer_name, total_cents, status, fulfillment_status, created_at')
      .neq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('product_variants')
      .select('id, name, sku, stock, product:products!inner(name, status)')
      .eq('is_active', true)
      .eq('product.status', 'published')
      .lte('stock', 5)
      .order('stock')
      .limit(8),
  ])
  if (error || !stats) return <p className="text-teja">No se pudieron cargar las estadísticas: {error?.message}</p>
  const s = stats as Stats
  const max = Math.max(1, ...s.daily.map((d) => d.revenue_cents))
  const avg = s.orders_paid ? Math.round(s.revenue_total_cents / s.orders_paid) : 0

  return (
    <>
      <AdminHeader title="Resumen" description="Ventas, pedidos y stock de un vistazo." />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Ventas últimos 30 días" value={formatPrice(s.revenue_30d_cents)} hint={`${s.orders_30d} pedidos`} />
        <Stat label="Ventas totales" value={formatPrice(s.revenue_total_cents)} hint={`Ticket medio ${formatPrice(avg)}`} />
        <Stat label="Por preparar o enviar" value={String(s.orders_to_ship)} tone={s.orders_to_ship ? 'teja' : 'ink'} hint="Pagados sin enviar" />
        <Stat label="Variantes con poco stock" value={String(s.low_stock)} tone={s.low_stock ? 'teja' : 'hoja'} hint="5 unidades o menos" />
        <Stat label="Clientes registrados" value={String(s.customers)} />
        <Stat label="Productos publicados" value={String(s.products_published)} />
        <Stat label="Pagos pendientes" value={String(s.orders_pending)} hint="Sesiones de pago abiertas" />
        <Stat label="Revisar" value={String(s.orders_review + s.reviews_pending)} tone={s.orders_review ? 'teja' : 'ink'} hint={`${s.orders_review} pedidos · ${s.reviews_pending} opiniones`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Ventas de los últimos 14 días">
          <div className="flex h-48 items-end gap-1.5" role="img" aria-label="Gráfico de ventas diarias">
            {s.daily.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
                <div
                  className="rounded-t-md bg-chef/80 transition-colors group-hover:bg-teja"
                  style={{ height: `${Math.max(2, (d.revenue_cents / max) * 100)}%` }}
                  title={`${new Date(d.day).toLocaleDateString('es-ES')}: ${formatPrice(d.revenue_cents)} (${d.orders} pedidos)`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-ash-ink">
            <span>{s.daily[0] && new Date(s.daily[0].day).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
            <span>Hoy</span>
          </div>
        </Card>
        <Card title="Más vendidos">
          {s.top_products.length === 0 ? (
            <p className="text-sm text-ash-ink">Aún no hay ventas.</p>
          ) : (
            <ol className="space-y-3 text-sm">
              {s.top_products.map((p, i) => (
                <li key={p.slug} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <span className="w-4 font-display font-bold text-chef">{i + 1}</span>
                    {p.name}
                  </span>
                  <span className="text-ash-ink tabular-nums">{p.sales_count} uds.</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Últimos pedidos</h2>
            <Link href="/admin/pedidos" className="text-sm text-teja hover:underline">
              Ver todos
            </Link>
          </div>
          <div className={table.wrap}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th className={table.th}>Pedido</th>
                  <th className={table.th}>Cliente</th>
                  <th className={table.th}>Estado</th>
                  <th className={`${table.th} text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(recent ?? []).map((o) => (
                  <tr key={o.id} className="hover:bg-mist/60">
                    <td className={table.td}>
                      <Link href={`/admin/pedidos/${o.id}`} className="font-medium hover:text-teja">
                        {formatOrderNumber(o.number)}
                      </Link>
                    </td>
                    <td className={table.td}>{o.customer_name}</td>
                    <td className={table.td}>
                      <OrderStatusBadge status={o.status} fulfillment={o.fulfillment_status} />
                    </td>
                    <td className={`${table.td} text-right tabular-nums`}>{formatPrice(o.total_cents)}</td>
                  </tr>
                ))}
                {(recent ?? []).length === 0 && (
                  <tr>
                    <td className={table.td} colSpan={4}>
                      Todavía no hay pedidos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <Card title="Stock bajo" actions={<Link href="/admin/inventario" className="text-sm text-teja hover:underline">Inventario</Link>}>
          {(lowStock ?? []).length === 0 ? (
            <p className="text-sm text-ash-ink">Todo con stock suficiente.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(lowStock ?? []).map((v) => (
                <li key={v.id} className="flex justify-between gap-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <span className="truncate">{(v.product as any)?.name} · {v.name}</span>
                  <span className={v.stock === 0 ? 'font-semibold text-teja' : 'text-ambar'}>{v.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
