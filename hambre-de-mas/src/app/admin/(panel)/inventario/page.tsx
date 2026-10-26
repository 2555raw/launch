import { StockInput } from '@/components/admin/stock-input'
import { AdminHeader, Card, table } from '@/components/admin/ui'
import { cn } from '@/lib/cn'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = { title: 'Inventario' }

/* eslint-disable @typescript-eslint/no-explicit-any -- filas sin tipar de PostgREST */

const reasonLabel: Record<string, string> = { initial: 'Alta', manual: 'Ajuste manual', order: 'Pedido', release: 'Liberado' }

export default async function InventoryPage() {
  const supabase = await createSupabaseServerClient()
  const [{ data: variants }, { data: movements }] = await Promise.all([
    supabase.from('product_variants').select('id, sku, name, stock, is_active, product:products(name, status)').order('stock'),
    supabase
      .from('inventory_movements')
      .select('id, delta, stock_after, reason, created_at, variant:product_variants(sku, name, product:products(name))')
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  return (
    <>
      <AdminHeader title="Inventario" description="Stock disponible por variante. El stock reservado por pagos en curso ya está descontado." />
      <div className="grid gap-6 2xl:grid-cols-[1.5fr_1fr]">
        <div className={table.wrap}>
          <table className={table.table}>
            <thead>
              <tr>
                <th className={table.th}>Producto</th>
                <th className={table.th}>Variante</th>
                <th className={table.th}>SKU</th>
                <th className={table.th}>Stock</th>
              </tr>
            </thead>
            <tbody>
              {(variants ?? []).map((v: any) => (
                <tr key={v.id} className={cn(!v.is_active && 'opacity-50')}>
                  <td className={table.td}>
                    {v.product?.name}
                    {v.product?.status !== 'published' && <span className="ml-2 text-xs text-ash-ink">({v.product?.status})</span>}
                  </td>
                  <td className={table.td}>{v.name}</td>
                  <td className={`${table.td} font-mono text-xs`}>{v.sku}</td>
                  <td className={table.td}>
                    <StockInput variantId={v.id} stock={v.stock} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Card title="Últimos movimientos">
          <ul className="space-y-2 text-sm">
            {(movements ?? []).map((m: any) => (
              <li key={m.id} className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate">
                    {m.variant?.product?.name} · {m.variant?.name}
                  </span>
                  <span className="block text-xs text-ash-ink">
                    {reasonLabel[m.reason] ?? m.reason} · {new Date(m.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </span>
                <span className={cn('shrink-0 font-medium tabular-nums', m.delta > 0 ? 'text-hoja-ink' : 'text-teja')}>
                  {m.delta > 0 ? '+' : ''}
                  {m.delta} → {m.stock_after}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
