'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { subscribeNewsletter, type NewsletterState } from '@/app/actions/newsletter'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export function NewsletterForm({ tone = 'light' }: { tone?: 'light' | 'warm' }) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeNewsletter, null)

  if (state?.ok) {
    return (
      <p className="rounded-2xl bg-white/70 px-5 py-4 text-[15px] font-medium text-hoja-ink" role="status">
        {state.message}
      </p>
    )
  }

  return (
    <form action={action} className="w-full max-w-md" noValidate>
      <div className={cn('flex items-center gap-2 rounded-full p-1.5 ring-1', tone === 'warm' ? 'bg-white ring-teja/15' : 'bg-white ring-line')}>
        <label htmlFor="newsletter-email" className="sr-only">
          Tu email
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          className="min-w-0 flex-1 bg-transparent px-4 text-[15px] focus:outline-none"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Enviando…' : 'Suscribirme'}
        </Button>
      </div>
      <label className="mt-3 flex items-start gap-2 text-xs text-ash-ink">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 shrink-0 accent-chef-ink" />
        <span>
          Quiero recibir novedades por email. He leído la{' '}
          <Link href="/legal/privacidad" className="underline underline-offset-2">
            política de privacidad
          </Link>{' '}
          y puedo darme de baja cuando quiera.
        </span>
      </label>
      {state && !state.ok && (
        <p className="mt-2 text-sm text-teja" role="alert">
          {state.message}
        </p>
      )}
    </form>
  )
}
