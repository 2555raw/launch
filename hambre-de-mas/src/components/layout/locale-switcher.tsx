'use client'

import { useFormStatus } from 'react-dom'
import { GlobeIcon } from '@/components/ui/icons'
import { setLocale } from '@/lib/i18n/actions'
import { useI18n } from '@/lib/i18n/client'
import { LOCALE_LABELS, LOCALES, type Locale } from '@/lib/i18n/config'
import { cn } from '@/lib/cn'

/**
 * Selector de idioma. Es un formulario normal: funciona aunque el JavaScript
 * no haya cargado, y la acción guarda la cookie y vuelve a pintar la página.
 */
export function LocaleSwitcher({ variant = 'compact', className }: { variant?: 'compact' | 'segmented'; className?: string }) {
  const { locale, t } = useI18n()

  if (variant === 'compact') {
    const other: Locale = locale === 'es' ? 'en' : 'es'
    return (
      <form action={setLocale} className={className}>
        <input type="hidden" name="locale" value={other} />
        <CompactButton other={other} label={t({ es: 'Switch to English', en: 'Cambiar a español' })} />
      </form>
    )
  }

  return (
    <form action={setLocale} className={cn('inline-flex rounded-full bg-white p-0.5 ring-1 ring-line', className)}>
      <span className="sr-only">{t({ es: 'Idioma', en: 'Language' })}</span>
      {LOCALES.map((code) => (
        <button
          key={code}
          type="submit"
          name="locale"
          value={code}
          aria-pressed={code === locale}
          aria-label={LOCALE_LABELS[code]}
          lang={code}
          className={cn(
            'rounded-full px-3 py-1 text-[12px] font-semibold uppercase transition-colors',
            code === locale ? 'bg-ink text-white' : 'text-ash-ink hover:text-ink',
          )}
        >
          {code}
        </button>
      ))}
    </form>
  )
}

function CompactButton({ other, label }: { other: Locale; label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      aria-label={label}
      title={label}
      lang={other}
      disabled={pending}
      className="flex h-10 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold text-ink/80 uppercase transition-colors hover:bg-mist hover:text-ink disabled:opacity-50"
    >
      <GlobeIcon size={17} />
      {other}
    </button>
  )
}
