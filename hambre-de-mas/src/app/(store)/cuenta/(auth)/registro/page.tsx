import type { Metadata } from 'next'
import Link from 'next/link'
import { SignUpForm, SocialButtons } from '@/components/account/auth-forms'
import { CheckIcon } from '@/components/ui/icons'
import { safeNext } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Crear cuenta', robots: { index: false } }

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const target = safeNext(next)
  return (
    <>
      <h1 className="text-center font-display text-4xl font-extrabold tracking-tight">
        Únete a la <span className="text-chef">cocina.</span>
      </h1>
      <p className="mt-2 text-center text-ash-ink">Crea tu cuenta con tu email en un minuto.</p>
      <ul className="mt-5 mb-8 grid gap-2 rounded-2xl bg-mist p-4 text-sm sm:grid-cols-2">
        {['Sigue tus pedidos y envíos', 'Guarda tus direcciones', 'Kits recomendados para tu nivel', 'Avisos de tus alérgenos'].map((b) => (
          <li key={b} className="flex items-center gap-2">
            <CheckIcon size={16} className="text-hoja-ink" /> {b}
          </li>
        ))}
      </ul>
      <SocialButtons next={target} />
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
