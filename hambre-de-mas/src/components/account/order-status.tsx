import { CheckIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { fulfillmentStatusLabel, orderStatusLabel } from '@/lib/orders/mapper'
import type { FulfillmentStatus, OrderStatus } from '@/lib/types'

export function OrderStatusBadge({ status, fulfillment }: { status: OrderStatus; fulfillment?: FulfillmentStatus }) {
  const label = status === 'paid' && fulfillment && fulfillment !== 'unfulfilled' ? fulfillmentStatusLabel[fulfillment] : orderStatusLabel[status]
  const tone =
    status === 'paid'
      ? fulfillment === 'delivered'
        ? 'bg-hoja/20 text-hoja-deep'
        : 'bg-ink text-white'
      : status === 'pending' || status === 'requires_review'
        ? 'bg-almendra text-teja'
        : 'bg-mist text-ash-ink'
  return <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold', tone)}>{label}</span>
}

const steps: { key: FulfillmentStatus; label: string }[] = [
  { key: 'unfulfilled', label: 'Pagado' },
  { key: 'preparing', label: 'Preparando' },
  { key: 'shipped', label: 'Enviado' },
  { key: 'delivered', label: 'Entregado' },
]

export function OrderTimeline({ fulfillment }: { fulfillment: FulfillmentStatus }) {
  if (fulfillment === 'returned') return <p className="mt-6 text-sm text-ash-ink">Este pedido se ha devuelto.</p>
  const current = steps.findIndex((s) => s.key === fulfillment)
  return (
    <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Estado del envío">
      {steps.map((s, i) => {
        const done = i <= current
        return (
          <li key={s.key} className="flex flex-col items-center text-center text-xs">
            <span className={cn('h-1.5 w-full rounded-full', done ? 'bg-hoja' : 'bg-line')} />
            <span className={cn('mt-3 grid size-7 place-items-center rounded-full', done ? 'bg-hoja text-white' : 'bg-mist text-ash')}>
              {done ? <CheckIcon size={14} strokeWidth={2.5} /> : i + 1}
            </span>
            <span className={cn('mt-1.5', done ? 'font-medium text-ink' : 'text-ash-ink')} aria-current={i === current ? 'step' : undefined}>
              {s.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
