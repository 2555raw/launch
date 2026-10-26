import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetRequestForm } from '@/components/account/auth-forms'

export const metadata: Metadata = { title: 'Recuperar contraseña', robots: { index: false } }

export default function ResetRequestPage() {
  return (
    <>
      <h1 className="text-center font-display text-4xl font-extrabold tracking-tight">¿Contraseña olvidada?</h1>
      <p className="mt-2 mb-8 text-center text-ash-ink">Escribe tu email y te mandamos un enlace para crear otra.</p>
      <ResetRequestForm />
      <p className="mt-8 text-center text-sm">
        <Link href="/cuenta/acceder" className="text-teja hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </>
  )
}
