import Link from 'next/link'
import { OrderStatusBadge } from '@/components/account/order-status'
import { AdminHeader, field, table } from '@/components/admin/ui'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/money'
import { formatOrderNumber, orderStatusLabel } from '@/lib/orders/mapper'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = { title: 'Pedidos' }

const filters = [
  { value: '', label: 'Todos' },
  { value: 'por-enviar', label: 'Por enviar' },
  { value: 'paid', label: 'Pagados' },
  { value: 'pending', label: 'Pendientes de pago' },
  { value: 'requires_review', label: 'En revisión' },
  { value: 'refunded', label: 'Reembolsados' },
  { value: 'cancelled', label: 'Cancelados' },
]

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string }> }) {
  const { estado = '', q = '' } = await searchParams
  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from('orders')
    .select('id, number, email, customer_name, total_cents, status, fulfillment_status, created_at, is_gift, items:order_items(quantity)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (estado === 'por-enviar') query = query.eq('status', 'paid').in('fulfillment_status', ['unfulfilled', 'preparing'])
  else if (estado && estado in orderStatusLabel) query = query.eq('status', estado)
  const term = q.trim()
  if (term) {
    const number = Number.parseInt(term.replace(/\D/g, ''), 10)
    query = Number.isFinite(number) && /\d/.test(term) && !term.includes('@') ? query.eq('number', number) : query.ilike('email', `%${term.replace(/[%_,()]/g, '')}%`)
  }
  const { data: orders } = await query

  return (
    <>
      <AdminHeader title="Pedidos" description="Pagos confirmados por Stripe, envíos y devoluciones." />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <Link
              key={f.value}
              href={f.value ? `/admin/pedidos?estado=${f.value}` : '/admin/pedidos'}
              className={cn('rounded-full px-3 py-1.5 text-xs font-medium', estado === f.value ? 'bg-ink text-white' : 'bg-white text-ink/75 hover:text-ink')}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form className="w-full max-w-xs" role="search">
          {estado && <input type="hidden" name="estado" value={estado} />}
          <label htmlFor="buscar-pedido" className="sr-only">
            Buscar por número o email
          </label>
          <input id="buscar-pedido" name="q" defaultValue={q} placeholder="Nº de pedido o email" className={field} />
        </form>
      </div>
      <div className={table.wrap}>
        <table className={table.table}>
          <thead>
            <tr>
              <th className={table.th}>Pedido</th>
              <th className={table.th}>Fecha</th>
              <th className={table.th}>Cliente</th>
              <th className={table.th}>Uds.</th>
              <th className={table.th}>Estado</th>
              <th className={`${table.th} text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id} className="hover:bg-mist/60">
                <td className={table.td}>
                  <Link href={`/admin/pedidos/${o.id}`} className="font-medium hover:text-teja">
                    {formatOrderNumber(o.number)}
                  </Link>
                </td>
                <td className={`${table.td} text-ash-ink`}>{new Date(o.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className={table.td}>
                  <span className="block">
                    {o.customer_name}
                    {o.is_gift && <span className="ml-1.5 rounded-full bg-almendra-soft px-2 py-0.5 text-[11px] font-medium text-teja">Regalo</span>}
                  </span>
                  <span className="block text-xs text-ash-ink">{o.email}</span>
                </td>
                <td className={table.td}>{(o.items ?? []).reduce((s: number, i: { quantity: number }) => s + i.quantity, 0)}</td>
                <td className={table.td}>
                  <OrderStatusBadge status={o.status} fulfillment={o.fulfillment_status} />
                </td>
                <td className={`${table.td} text-right tabular-nums`}>{formatPrice(o.total_cents)}</td>
              </tr>
            ))}
            {(orders ?? []).length === 0 && (
              <tr>
                <td className={table.td} colSpan={6}>
                  No hay pedidos con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
