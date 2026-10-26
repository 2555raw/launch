import type { Metadata } from 'next'
import Link from 'next/link'
import { SignUpForm } from '@/components/account/auth-forms'
import { safeNext } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Crear cuenta', robots: { index: false } }

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const target = safeNext(next)
  return (
    <>
      <h1 className="text-center font-display text-4xl font-extrabold tracking-tight">Únete a la cocina.</h1>
      <p className="mt-2 mb-8 text-center text-ash-ink">Guarda tus direcciones, sigue tus pedidos y opina sobre tus kits.</p>
      <SignUpForm next={target} />
      <p className="mt-8 text-center text-sm text-ash-ink">
        ¿Ya tienes cuenta?{' '}
        <Link href={`/cuenta/acceder?next=${encodeURIComponent(target)}`} className="font-medium text-teja hover:underline">
          Inicia sesión
        </Link>
      </p>
    </>
  )
}
