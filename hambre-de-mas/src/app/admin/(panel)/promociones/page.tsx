import { togglePromotion } from '@/app/actions/admin'
import { PromotionForm } from '@/components/admin/promotion-form'
import { AdminHeader, Card, table } from '@/components/admin/ui'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/money'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = { title: 'Promociones' }

const isExpired = (endsAt: string | null) => Boolean(endsAt && new Date(endsAt).getTime() < Date.now())

export default async function PromotionsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: promotions } = await supabase.from('promotions').select('*').order('created_at', { ascending: false })
  return (
    <>
      <AdminHeader title="Promociones" description="Códigos de descuento. Se validan siempre en el servidor y se aplican en Stripe como cupón de un solo uso." />
      <div className="grid gap-6 2xl:grid-cols-[1.5fr_1fr]">
        <div className={table.wrap}>
          <table className={table.table}>
            <thead>
              <tr>
                <th className={table.th}>Código</th>
                <th className={table.th}>Descuento</th>
                <th className={table.th}>Mínimo</th>
                <th className={table.th}>Usos</th>
                <th className={table.th}>Vigencia</th>
                <th className={table.th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {(promotions ?? []).map((p) => {
                const expired = isExpired(p.ends_at)
                return (
                  <tr key={p.id}>
                    <td className={table.td}>
                      <span className="font-mono font-semibold">{p.code}</span>
                      {p.description && <span className="block text-xs text-ash-ink">{p.description}</span>}
                    </td>
                    <td className={table.td}>{p.kind === 'percent' ? `${p.value} %` : formatPrice(p.value)}</td>
                    <td className={table.td}>{p.min_subtotal_cents ? formatPrice(p.min_subtotal_cents) : '—'}</td>
                    <td className={`${table.td} tabular-nums`}>
                      {p.times_redeemed}
                      {p.max_redemptions ? ` / ${p.max_redemptions}` : ''}
                    </td>
                    <td className={`${table.td} text-xs text-ash-ink`}>
                      {p.starts_at ? new Date(p.starts_at).toLocaleDateString('es-ES') : 'Siempre'} → {p.ends_at ? new Date(p.ends_at).toLocaleDateString('es-ES') : 'sin fin'}
                    </td>
                    <td className={table.td}>
                      <form action={togglePromotion}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="active" value={String(!p.is_active)} />
                        <button
                          className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-medium',
                            p.is_active && !expired ? 'bg-hoja/15 text-hoja-deep' : 'bg-mist text-ash-ink',
                          )}
                          title={p.is_active ? 'Desactivar' : 'Activar'}
                        >
                          {expired ? 'Caducada' : p.is_active ? 'Activa' : 'Inactiva'}
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <Card title="Nueva promoción">
          <PromotionForm />
        </Card>
      </div>
    </>
  )
}
