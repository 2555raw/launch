import { AdminHeader, table } from '@/components/admin/ui'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const metadata = { title: 'Encargos' }

type PreorderRow = {
  id: string
  name: string
  email: string
  quantity: number
  locale: string
  created_at: string
  product: { name: string } | null
  variant: { name: string } | null
}

/** Quién ha encargado las ediciones que aún no se venden (p. ej. la caja de Navidad). */
export default async function PreordersPage() {
  const supabase = await createSupabaseServerClient()
  const { data: preorders } = await supabase
    .from('preorders')
    .select('id, name, email, quantity, locale, created_at, product:products(name), variant:product_variants(name)')
    .order('created_at', { ascending: false })
    .limit(500)
    .overrideTypes<PreorderRow[], { merge: false }>()
  const boxes = (preorders ?? []).reduce((n, p) => n + p.quantity, 0)

  return (
    <>
      <AdminHeader
        title="Encargos"
        description={`Ediciones que todavía no se pueden comprar. No se ha cobrado nada: escribe a cada cliente para confirmar antes del envío. Cajas encargadas: ${boxes}.`}
      />
      <div className={table.wrap}>
        <table className={table.table}>
          <thead>
            <tr>
              <th className={table.th}>Cliente</th>
              <th className={table.th}>Kit</th>
              <th className={table.th}>Cantidad</th>
              <th className={table.th}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {(preorders ?? []).map((p) => (
              <tr key={p.id}>
                <td className={table.td}>
                  <span className="block font-medium">{p.name}</span>
                  <span className="block text-xs text-ash-ink">
                    {p.email} · {p.locale.toUpperCase()}
                  </span>
                </td>
                <td className={table.td}>
                  {p.product?.name ?? '—'}
                  <span className="block text-xs text-ash-ink">{p.variant?.name}</span>
                </td>
                <td className={`${table.td} tabular-nums`}>{p.quantity}</td>
                <td className={`${table.td} text-ash-ink`}>{new Date(p.created_at).toLocaleDateString('es-ES')}</td>
              </tr>
            ))}
            {(preorders ?? []).length === 0 && (
              <tr>
                <td className={`${table.td} text-ash-ink`} colSpan={4}>
                  Todavía no hay encargos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
