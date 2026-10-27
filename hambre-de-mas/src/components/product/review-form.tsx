'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { submitReview, type ReviewState } from '@/app/actions/reviews'
import { Button } from '@/components/ui/button'
import { StarIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'

export function ReviewForm({ productId, productSlug }: { productId: string; productSlug: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReview, null)

  if (state?.ok) {
    return (
      <p className="mt-8 rounded-2xl bg-hoja/15 px-5 py-4 text-sm font-medium text-hoja-deep" role="status">
        {state.message}
      </p>
    )
  }

  if (!open) {
    return (
      <div className="mt-8">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {t({ es: 'He comprado este kit: escribir opinión', en: 'I bought this kit: write a review' })}
        </Button>
      </div>
    )
  }

  const field = 'w-full rounded-2xl border border-line-strong bg-white px-4 py-3 text-[15px] focus:border-ink focus:outline-none'

  return (
    <form action={action} className="mt-8 max-w-xl space-y-4 rounded-[22px] bg-mist p-6">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">{t({ es: 'Tu valoración', en: 'Your rating' })}</legend>
        <div className="flex gap-1" role="radiogroup" aria-label={t({ es: 'Valoración de 1 a 5', en: 'Rating from 1 to 5' })}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={t({ es: `${n} ${n === 1 ? 'estrella' : 'estrellas'}`, en: `${n} ${n === 1 ? 'star' : 'stars'}` })}
              onClick={() => setRating(n)}
              className={cn('transition-transform hover:scale-110', n <= rating ? 'text-chef' : 'text-line-strong')}
            >
              <StarIcon size={26} filled={n <= rating} />
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium">
        {t({ es: 'Tu nombre (se publicará)', en: 'Your name (will be published)' })}
        <input name="authorName" required maxLength={60} className={cn(field, 'mt-1.5')} />
      </label>
      <label className="block text-sm font-medium">
        {t({ es: 'Título', en: 'Title' })} <span className="font-normal text-ash-ink">{t({ es: '(opcional)', en: '(optional)' })}</span>
        <input name="title" maxLength={100} className={cn(field, 'mt-1.5')} />
      </label>
      <label className="block text-sm font-medium">
        {t({ es: 'Tu opinión', en: 'Your review' })}
        <textarea name="body" required minLength={10} maxLength={2000} rows={4} className={cn(field, 'mt-1.5')} />
      </label>
      {state && !state.ok && (
        <p className="text-sm text-teja" role="alert">
          {state.message}{' '}
          {state.code === 'auth' && (
            <Link href={`/cuenta/acceder?next=/producto/${productSlug}`} className="underline">
              {t({ es: 'Iniciar sesión', en: 'Sign in' })}
            </Link>
          )}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t({ es: 'Enviando…', en: 'Sending…' }) : t({ es: 'Enviar opinión', en: 'Submit review' })}
      </Button>
    </form>
  )
}
