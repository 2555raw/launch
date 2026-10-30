'use client'

import { GiftIcon } from '@/components/ui/icons'
import { useI18n } from '@/lib/i18n/client'
import { dayLabel, preorderClosesAt } from '@/lib/preorder'
import { useNow } from '@/lib/use-now'
import type { Preorder } from '@/lib/types'

function Countdown({ until, now }: { until: Date; now: Date | null }) {
  const { t } = useI18n()
  const left = now ? Math.max(0, until.getTime() - now.getTime()) : null
  const parts = [
    { value: left == null ? null : Math.floor(left / 86_400_000), label: t({ es: 'días', en: 'days' }) },
    { value: left == null ? null : Math.floor(left / 3_600_000) % 24, label: t({ es: 'horas', en: 'hours' }) },
    { value: left == null ? null : Math.floor(left / 60_000) % 60, label: t({ es: 'min', en: 'min' }) },
    { value: left == null ? null : Math.floor(left / 1000) % 60, label: t({ es: 'seg', en: 'sec' }) },
  ]
  return (
    <div className="grid grid-cols-4 gap-2" role="timer" aria-live="off">
      {parts.map((p) => (
        <div key={p.label} className="rounded-[14px] bg-hoja-deep px-2 py-3 text-center text-white">
          <span className="block font-display text-[26px] leading-none font-bold tabular-nums">{p.value == null ? '–' : String(p.value).padStart(2, '0')}</span>
          <span className="mt-1 block text-[11px] font-semibold tracking-wide text-white/70 uppercase">{p.label}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Edición por encargo: se paga al encargarla y se envía el día de salida. Muestra
 * la cuenta atrás hasta que se cierran los encargos y, mientras sigan abiertos,
 * los botones de compra (`children`). Cerrado el plazo, solo un aviso.
 */
export function PreorderBox({ preorder, children }: { preorder: Preorder; children: React.ReactNode }) {
  const { locale, t } = useI18n()
  const now = useNow()
  const closesAt = preorderClosesAt(preorder)
  const closed = now != null && now >= closesAt
  const release = dayLabel(preorder.releaseDate, locale)
  const lastDay = preorder.closesDate ? dayLabel(preorder.closesDate, locale) : null

  if (closed) {
    return (
      <div className="flex gap-3 rounded-[20px] bg-mist p-5">
        <GiftIcon size={20} className="mt-0.5 shrink-0 text-ash-ink" />
        <div className="text-sm text-ink/80">
          <p className="text-[15px] font-semibold text-ink">{t({ es: 'Se acabaron los encargos', en: 'Pre-orders have closed' })}</p>
          <p className="mt-1">
            {t({ es: `Sale el ${release}. Ese día ya se podrá comprar si quedan cajas.`, en: `It comes out on ${release}. You'll be able to buy it then if there are boxes left.` })}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[20px] bg-mist p-5">
        <div className="flex gap-3">
          <GiftIcon size={20} className="mt-0.5 shrink-0 text-chef-ink" />
          <div className="text-sm text-ink/80">
            <p className="text-[15px] font-semibold text-ink">
              {lastDay
                ? t({ es: `Encárgala hasta el ${lastDay} · sale el ${release}`, en: `Pre-order until ${lastDay} · out on ${release}` })
                : t({ es: `Solo por encargo · sale el ${release}`, en: `Pre-order only · out on ${release}` })}
            </p>
            <p className="mt-1">
              {t({
                es: `Edición limitada. La pagas al encargarla y te la enviamos el ${release}. Si la pides con otros kits, llega todo junto ese día.`,
                en: `Limited edition. You pay when you pre-order and we ship it on ${release}. If you order it with other kits, everything arrives together that day.`,
              })}
            </p>
          </div>
        </div>
        <p className="mt-4 mb-2 text-xs font-semibold text-ash-ink">{t({ es: 'Se cierran los encargos en', en: 'Pre-orders close in' })}</p>
        <Countdown until={closesAt} now={now} />
      </div>
      {children}
    </div>
  )
}
