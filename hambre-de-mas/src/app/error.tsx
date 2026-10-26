'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Button, buttonClass } from '@/components/ui/button'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <main id="contenido" className="grid min-h-[70dvh] place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="eyebrow">Algo ha fallado</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Se nos ha quemado algo.</h1>
        <p className="mt-3 text-ash-ink">Ha ocurrido un error inesperado. Prueba otra vez en unos segundos.</p>
        {error.digest && <p className="mt-2 text-xs text-ash">Código: {error.digest}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={reset}>
            Reintentar
          </Button>
          <Link href="/" className={buttonClass('secondary', 'lg')}>
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  )
}
