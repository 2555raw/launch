'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { reservePreorder, type PreorderState } from '@/app/actions/preorder'
import { QuantityStepper } from '@/components/cart/cart-line'
import { Button } from '@/components/ui/button'
import { CheckIcon, GiftIcon } from '@/components/ui/icons'
import { commerce } from '@/lib/config/commerce'
import { useI18n } from '@/lib/i18n/client'
import { dayLabel, preorderClosesAt } from '@/lib/preorder'
import type { Preorder } from '@/lib/types'

const field =
  'h-12 w-full rounded-[14px] bg-white px-4 text-[15px] ring-1 ring-line transition-shadow placeholder:text-ash focus:ring-2 focus:ring-ink focus:outline-none'

/** Reloj que se actualiza cada segundo (solo en el navegador, para no desajustar el HTML del servidor). */
function useNow() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

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

/** Encargo de una edición que aún no se vende: cuenta atrás hasta el cierre y formulario (nombre y email). */
export function PreorderForm({
  variantId,
  quantity,
  onQuantity,
  preorder,
}: {
  variantId: string
  quantity: number
  onQuantity: (n: number) => void
  preorder: Preorder
}) {
  const { locale, t } = useI18n()
  const [state, action, pending] = useActionState<PreorderState, FormData>(reservePreorder, null)
  const now = useNow()
  const closesAt = preorderClosesAt(preorder)
  const closed = now != null && now >= closesAt
  const release = dayLabel(preorder.releaseDate, locale)
  const lastDay = preorder.closesDate ? dayLabel(preorder.closesDate, locale) : null

  if (state?.ok) {
    return (
      <div className="flex gap-3 rounded-[20px] bg-hoja/15 p-5 text-[15px] text-hoja-ink" role="status">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-hoja-ink text-white">
          <CheckIcon size={14} strokeWidth={2.5} />
        </span>
        <p className="font-medium">{state.message}</p>
      </div>
    )
  }

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
    <form action={action} className="space-y-5" noValidate>
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
                es: 'Edición limitada. Encárgala ahora sin pagar nada: te la guardamos y te escribimos para confirmarla antes del envío.',
                en: "Limited edition. Pre-order it now without paying anything: we'll keep it for you and email you to confirm it before it ships.",
              })}
            </p>
          </div>
        </div>
        <p className="mt-4 mb-2 text-xs font-semibold text-ash-ink">{t({ es: 'Se cierran los encargos en', en: 'Pre-orders close in' })}</p>
        <Countdown until={closesAt} now={now} />
      </div>

      <QuantityStepper value={quantity} max={commerce.maxQuantityPerLine} onChange={(n) => onQuantity(Math.max(1, Math.min(n, commerce.maxQuantityPerLine)))} label={t({ es: 'Cajas', en: 'Boxes' })} />

      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="quantity" value={quantity} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="sr-only">{t({ es: 'Tu nombre', en: 'Your name' })}</span>
          <input name="fullName" required autoComplete="name" maxLength={120} placeholder={t({ es: 'Tu nombre', en: 'Your name' })} className={field} />
        </label>
        <label className="block">
          <span className="sr-only">{t({ es: 'Tu email', en: 'Your email' })}</span>
          <input name="email" type="email" required autoComplete="email" placeholder={t({ es: 'tu@email.com', en: 'you@email.com' })} className={field} />
        </label>
      </div>
      <label className="flex items-start gap-2 text-xs text-ash-ink">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 shrink-0 accent-chef-ink" />
        <span>
          {t({ es: 'Podéis escribirme sobre este encargo. He leído la', en: 'You may email me about this pre-order. I have read the' })}{' '}
          <Link href="/legal/privacidad" className="underline underline-offset-2">
            {t({ es: 'política de privacidad', en: 'privacy policy' })}
          </Link>
          .
        </span>
      </label>
      {state && !state.ok && (
        <p className="text-sm text-teja" role="alert">
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? t({ es: 'Encargando…', en: 'Pre-ordering…' }) : t({ es: 'Encargar', en: 'Pre-order' })}
      </Button>
    </form>
  )
}
