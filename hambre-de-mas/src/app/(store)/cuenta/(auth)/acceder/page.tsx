import type { Metadata } from 'next'
import Link from 'next/link'
import { SignInForm } from '@/components/account/auth-forms'
import { safeNext } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Iniciar sesión', robots: { index: false } }

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const target = safeNext(next)
  return (
    <>
      <h1 className="text-center font-display text-4xl font-extrabold tracking-tight">Hola de nuevo.</h1>
      <p className="mt-2 mb-8 text-center text-ash-ink">Entra para ver tus pedidos y comprar más rápido.</p>
      {error && (
        <p className="mb-4 rounded-2xl bg-almendra-soft px-4 py-3 text-sm text-teja" role="alert">
          El enlace no es válido o ha caducado. Inténtalo de nuevo.
        </p>
      )}
      <SignInForm next={target} />
      <p className="mt-8 text-center text-sm text-ash-ink">
        ¿Primera vez por aquí?{' '}
        <Link href={`/cuenta/registro?next=${encodeURIComponent(target)}`} className="font-medium text-teja hover:underline">
          Crea tu cuenta
        </Link>
      </p>
    </>
  )
}
