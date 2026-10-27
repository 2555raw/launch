'use client'

import { CheckIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'
import { fulfillmentStatusLabel, fulfillmentStatusLabelEn, orderStatusLabel, orderStatusLabelEn } from '@/lib/orders/mapper'
import type { FulfillmentStatus, OrderStatus } from '@/lib/types'

export function OrderStatusBadge({ status, fulfillment }: { status: OrderStatus; fulfillment?: FulfillmentStatus }) {
  const { locale } = useI18n()
  const fulfillmentLabels = locale === 'en' ? fulfillmentStatusLabelEn : fulfillmentStatusLabel
  const statusLabels = locale === 'en' ? orderStatusLabelEn : orderStatusLabel
  const label = status === 'paid' && fulfillment && fulfillment !== 'unfulfilled' ? fulfillmentLabels[fulfillment] : statusLabels[status]
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

const steps: { key: FulfillmentStatus; label: { es: string; en: string } }[] = [
  { key: 'unfulfilled', label: { es: 'Pagado', en: 'Paid' } },
  { key: 'preparing', label: { es: 'Preparando', en: 'Preparing' } },
  { key: 'shipped', label: { es: 'Enviado', en: 'Shipped' } },
  { key: 'delivered', label: { es: 'Entregado', en: 'Delivered' } },
]

export function OrderTimeline({ fulfillment }: { fulfillment: FulfillmentStatus }) {
  const { t } = useI18n()
  if (fulfillment === 'returned') return <p className="mt-6 text-sm text-ash-ink">{t({ es: 'Este pedido se ha devuelto.', en: 'This order has been returned.' })}</p>
  const current = steps.findIndex((s) => s.key === fulfillment)
  return (
    <ol className="mt-8 grid grid-cols-4 gap-2" aria-label={t({ es: 'Estado del envío', en: 'Delivery status' })}>
      {steps.map((s, i) => {
        const done = i <= current
        return (
          <li key={s.key} className="flex flex-col items-center text-center text-xs">
            <span className={cn('h-1.5 w-full rounded-full', done ? 'bg-hoja' : 'bg-line')} />
            <span className={cn('mt-3 grid size-7 place-items-center rounded-full', done ? 'bg-hoja text-white' : 'bg-mist text-ash')}>
              {done ? <CheckIcon size={14} strokeWidth={2.5} /> : i + 1}
            </span>
            <span className={cn('mt-1.5', done ? 'font-medium text-ink' : 'text-ash-ink')} aria-current={i === current ? 'step' : undefined}>
              {t(s.label)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
