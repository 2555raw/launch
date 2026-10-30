'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { reservePreorder, type PreorderState } from '@/app/actions/preorder'
import { Button } from '@/components/ui/button'
import { CheckIcon, GiftIcon } from '@/components/ui/icons'
import { useI18n } from '@/lib/i18n/client'
import { releaseLabel } from '@/lib/preorder'

const field =
  'h-12 w-full rounded-[14px] bg-white px-4 text-[15px] ring-1 ring-line transition-shadow placeholder:text-ash focus:ring-2 focus:ring-ink focus:outline-none'

/** Encargo de una edición que aún no se vende: nombre y email, sin pagar nada. */
export function PreorderForm({ variantId, quantity, releaseDate }: { variantId: string; quantity: number; releaseDate: string }) {
  const { locale, t } = useI18n()
  const [state, action, pending] = useActionState<PreorderState, FormData>(reservePreorder, null)
  const day = releaseLabel(releaseDate, locale)

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

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="flex gap-3 rounded-[20px] bg-mist p-5">
        <GiftIcon size={20} className="mt-0.5 shrink-0 text-chef-ink" />
        <div className="text-sm text-ink/80">
          <p className="text-[15px] font-semibold text-ink">{t({ es: `Solo por encargo · sale el ${day}`, en: `Pre-order only · out on ${day}` })}</p>
          <p className="mt-1">
            {t({
              es: 'Edición limitada. Encárgala ahora sin pagar nada: te la guardamos y te escribimos para confirmarla antes del envío.',
              en: "Limited edition. Pre-order it now without paying anything: we'll keep it for you and email you to confirm it before it ships.",
            })}
          </p>
        </div>
      </div>

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
