'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Button, buttonClass } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n/client'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n()
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <main id="contenido" className="grid min-h-[70dvh] place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="eyebrow">{t({ es: 'Algo ha fallado', en: 'Something went wrong' })}</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">{t({ es: 'Se nos ha quemado algo.', en: 'Something got burnt.' })}</h1>
        <p className="mt-3 text-ash-ink">
          {t({ es: 'Ha ocurrido un error inesperado. Prueba otra vez en unos segundos.', en: 'An unexpected error happened. Try again in a few seconds.' })}
        </p>
        {error.digest && <p className="mt-2 text-xs text-ash">{t({ es: 'Código', en: 'Code' })}: {error.digest}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={reset}>
            {t({ es: 'Reintentar', en: 'Try again' })}
          </Button>
          <Link href="/" className={buttonClass('secondary', 'lg')}>
            {t({ es: 'Ir al inicio', en: 'Go home' })}
          </Link>
        </div>
      </div>
    </main>
  )
}
