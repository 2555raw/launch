import { AdminHeader, table } from '@/components/admin/ui'
import { formatPrice } from '@/lib/money'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = { title: 'Clientes' }

export default async function CustomersPage() {
  const supabase = await createSupabaseServerClient()
  const [{ data: profiles }, { data: orders }, { count: subscribers }] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name, phone, role, marketing_opt_in, created_at').order('created_at', { ascending: false }).limit(200),
    supabase.from('orders').select('user_id, total_cents').eq('status', 'paid').not('user_id', 'is', null),
    supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).is('unsubscribed_at', null),
  ])
  const totals = new Map<string, { count: number; spent: number }>()
  for (const o of orders ?? []) {
    const t = totals.get(o.user_id) ?? { count: 0, spent: 0 }
    totals.set(o.user_id, { count: t.count + 1, spent: t.spent + o.total_cents })
  }

  return (
    <>
      <AdminHeader
        title="Clientes"
        description={`Cuentas registradas. Los datos personales solo deben usarse para gestionar pedidos. Suscriptores a la newsletter: ${subscribers ?? 0}.`}
      />
      <div className={table.wrap}>
        <table className={table.table}>
          <thead>
            <tr>
              <th className={table.th}>Cliente</th>
              <th className={table.th}>Alta</th>
              <th className={table.th}>Pedidos</th>
              <th className={table.th}>Gastado</th>
              <th className={table.th}>Marketing</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => {
              const t = totals.get(p.id)
              return (
                <tr key={p.id}>
                  <td className={table.td}>
                    <span className="block font-medium">
                      {p.full_name ?? '—'} {p.role === 'admin' && <span className="ml-1 rounded-full bg-ink px-2 py-0.5 text-[10px] text-white">admin</span>}
                    </span>
                    <span className="block text-xs text-ash-ink">
                      {p.email}
                      {p.phone ? ` · ${p.phone}` : ''}
                    </span>
                  </td>
                  <td className={`${table.td} text-ash-ink`}>{new Date(p.created_at).toLocaleDateString('es-ES')}</td>
                  <td className={`${table.td} tabular-nums`}>{t?.count ?? 0}</td>
                  <td className={`${table.td} tabular-nums`}>{formatPrice(t?.spent ?? 0)}</td>
                  <td className={table.td}>{p.marketing_opt_in ? 'Sí' : 'No'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
