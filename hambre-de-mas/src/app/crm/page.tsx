import Link from 'next/link'
import { Suspense } from 'react'
import { AdminHeader, Card, Stat } from '@/components/admin/ui'
import { CustomerTable, type CustomerRow } from '@/components/crm/customer-table'
import { getCrmData } from '@/lib/crm/repository'
import { crmKpis, customerStats, SEGMENTS, segmentsOf } from '@/lib/crm/segments'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/money'

export const metadata = { title: 'Clientes' }

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ segmento?: string }> }) {
  const [{ demo, customers }, { segmento }] = await Promise.all([getCrmData(), searchParams])
  const now = new Date()
  const kpis = crmKpis(customers, now)
  const rows: CustomerRow[] = customers.map((c) => {
    const s = customerStats(c, now)
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      city: c.city,
      segments: segmentsOf(c, now),
      orderCount: s.orderCount,
      spentCents: s.spentCents,
      lastOrder: s.lastOrder?.toISOString() ?? null,
      favoriteLevel: s.favoriteLevel?.name ?? null,
      tags: c.tags,
      openTasks: c.tasks.filter((t) => !t.done).length,
    }
  })
  const tasks = customers
    .flatMap((c) => c.tasks.filter((t) => !t.done).map((t) => ({ ...t, customer: c })))
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
  const today = now.toISOString().slice(0, 10)

  return (
    <>
      <AdminHeader
        title="Clientes"
        description={
          demo
            ? 'Vista previa con clientes de ejemplo (nombres inventados). Con la base de datos conectada salen los clientes reales: todos los que han pagado un pedido, tienen cuenta o están en la newsletter.'
            : 'Todos los que han pagado un pedido (también sin cuenta), tienen cuenta o están en la newsletter.'
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Clientes" value={String(kpis.customers)} hint={`${kpis.buyers} han comprado`} />
        <Stat label="Repiten" value={`${Math.round(kpis.repeatRate * 100)} %`} hint="de los que han comprado" tone="hoja" />
        <Stat label="Ticket medio" value={formatPrice(kpis.avgTicketCents)} hint="por pedido" />
        <Stat label="Valor por cliente" value={formatPrice(kpis.avgValueCents)} hint="gasto total medio" />
        <Stat label="En riesgo" value={String(kpis.bySegment['en-riesgo'])} hint="hay que recuperarlos" tone="teja" />
      </div>

      <section aria-label="Segmentos" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {SEGMENTS.map((s) => (
          <Link
            key={s.key}
            href={segmento === s.key ? '/crm' : `/crm?segmento=${s.key}`}
            scroll={false}
            className={cn(
              'rounded-[18px] bg-white p-4 shadow-card ring-1 transition-shadow hover:shadow-card-hover',
              segmento === s.key ? 'ring-2 ring-ink' : 'ring-black/[0.03]',
            )}
          >
            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', s.tone)}>{s.label}</span>
            <p className="mt-2 font-display text-2xl font-extrabold tabular-nums">{kpis.bySegment[s.key]}</p>
            <p className="mt-0.5 text-xs leading-snug text-ash-ink">{s.hint}</p>
          </Link>
        ))}
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_300px]">
        <Suspense>
          <CustomerTable rows={rows} />
        </Suspense>
        <Card title={`Tareas pendientes (${tasks.length})`} className="self-start">
          {tasks.length === 0 ? (
            <p className="text-sm text-ash-ink">No hay tareas. Créalas desde la ficha de cada cliente.</p>
          ) : (
            <ul className="space-y-3">
              {tasks.slice(0, 12).map((t) => (
                <li key={t.id} className="text-sm">
                  <Link href={`/crm/${t.customer.id}`} className="font-medium hover:text-teja">
                    {t.title}
                  </Link>
                  <span className="block text-xs text-ash-ink">
                    {t.customer.name}
                    {t.dueDate && (
                      <span className={cn('ml-1', t.dueDate < today ? 'font-semibold text-teja' : t.dueDate === today ? 'font-semibold text-ambar' : '')}>
                        · {t.dueDate < today ? 'vencida' : t.dueDate === today ? 'hoy' : `para el ${new Date(t.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 border-t border-line pt-3 text-xs text-ash-ink">Facturación de estos clientes: {formatPrice(kpis.revenueCents)}</p>
        </Card>
      </div>
    </>
  )
}
