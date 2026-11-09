import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, Stat } from '@/components/admin/ui'
import { FollowUp } from '@/components/crm/follow-up'
import { ago, SegmentBadge } from '@/components/crm/segment-badge'
import { buttonClass } from '@/components/ui/button'
import { getCrmData } from '@/lib/crm/repository'
import { customerStats, nextAction, segmentsOf } from '@/lib/crm/segments'
import { formatPrice } from '@/lib/money'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const customer = (await getCrmData()).customers.find((c) => c.id === id)
  return { title: customer?.name ?? 'Cliente' }
}

const date = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

export default async function CustomerPage({ params }: Props) {
  const { id } = await params
  const { demo, customers } = await getCrmData()
  const c = customers.find((x) => x.id === id)
  if (!c) notFound()
  const now = new Date()
  const s = customerStats(c, now)
  const segments = segmentsOf(c, now)
  const action = nextAction(c, now)
  const orders = [...c.orders].sort((a, b) => b.date.localeCompare(a.date))
  // Kits que más repite
  const favorites = [...orders.flatMap((o) => o.items).reduce((m, i) => m.set(i.name, (m.get(i.name) ?? 0) + i.quantity), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  return (
    <>
      <Link href="/crm" className="text-sm text-ash-ink hover:text-ink">
        ← Clientes
      </Link>
      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">{c.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {segments.map((seg) => (
              <SegmentBadge key={seg} segment={seg} />
            ))}
            {c.hasAccount && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ash-ink ring-1 ring-line">Con cuenta</span>}
            {c.newsletter && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-ash-ink ring-1 ring-line">Newsletter</span>}
          </div>
          <p className="mt-3 text-sm text-ash-ink">
            <a href={`mailto:${c.email}`} className="text-ink hover:text-teja">
              {c.email}
            </a>
            {c.phone && <> · {c.phone}</>}
            {(c.city || c.province) && <> · {[c.city, c.province].filter((v, i, a) => v && a.indexOf(v) === i).join(', ')}</>}
            {' · '}cliente desde {date(c.since)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pedidos" value={String(s.orderCount)} />
        <Stat label="Gastado" value={formatPrice(s.spentCents)} tone="hoja" />
        <Stat label="Ticket medio" value={s.orderCount ? formatPrice(s.avgTicketCents) : '—'} />
        <Stat label="Último pedido" value={ago(s.lastOrder?.toISOString() ?? null, now)} hint={s.favoriteLevel ? `Nivel favorito: ${s.favoriteLevel.name}` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {action && (
            <section className="rounded-[22px] bg-ink p-5 text-white sm:p-6">
              <p className="text-xs font-semibold tracking-wide text-white/60 uppercase">Siguiente paso recomendado</p>
              <p className="mt-1 font-display text-xl font-bold">{action.title}</p>
              <p className="mt-2 text-sm text-white/70">Asunto: {action.subject}</p>
              <a
                href={`mailto:${c.email}?subject=${encodeURIComponent(action.subject)}&body=${encodeURIComponent(action.body)}`}
                className={buttonClass('primary', 'sm', 'mt-4')}
              >
                Escribirle con el email preparado
              </a>
            </section>
          )}

          <Card title={`Pedidos (${orders.length})`}>
            {orders.length === 0 ? (
              <p className="text-sm text-ash-ink">Todavía no ha comprado.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-5">
                {orders.map((o) => (
                  <li key={o.id} className="relative">
                    <span aria-hidden className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-chef-ink ring-4 ring-white" />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {o.number} <span className="font-normal text-ash-ink">· {date(o.date)}</span>
                      </p>
                      <p className="text-sm font-semibold tabular-nums">{formatPrice(o.totalCents)}</p>
                    </div>
                    <p className="mt-0.5 text-sm text-ash-ink">{o.items.map((i) => (i.quantity > 1 ? `${i.quantity} × ${i.name}` : i.name)).join(' · ')}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {favorites.length > 0 && (
            <Card title="Lo que más compra">
              <ul className="space-y-1.5 text-sm">
                {favorites.map(([name, units]) => (
                  <li key={name} className="flex justify-between gap-3">
                    <span>{name}</span>
                    <span className="text-ash-ink tabular-nums">{units} {units === 1 ? 'vez' : 'veces'}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <FollowUp email={c.email} customerId={c.id} initial={{ notes: c.notes, tasks: c.tasks, tags: c.tags }} demo={demo} />
      </div>
    </>
  )
}
