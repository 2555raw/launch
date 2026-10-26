import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonClass } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Sin acceso', robots: { index: false } }

export default function NoAccessPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-mist px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Zona solo para el equipo.</h1>
        <p className="mt-3 text-ash-ink">Tu cuenta no tiene permisos de administración. Si crees que es un error, pide a un administrador que te los dé.</p>
        <Link href="/" className={buttonClass('primary', 'lg', 'mt-8')}>
          Volver a la tienda
        </Link>
      </div>
    </div>
  )
}
