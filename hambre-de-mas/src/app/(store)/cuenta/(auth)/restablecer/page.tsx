import type { Metadata } from 'next'
import { NewPasswordForm } from '@/components/account/auth-forms'
import { requireUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nueva contraseña', robots: { index: false } }

export default async function NewPasswordPage() {
  // El enlace del email ya ha iniciado sesión (ruta /auth/confirm).
  await requireUser('/cuenta/restablecer')
  return (
    <>
      <h1 className="text-center font-display text-4xl font-extrabold tracking-tight">Nueva contraseña.</h1>
      <p className="mt-2 mb-8 text-center text-ash-ink">Elige una que no uses en otros sitios.</p>
      <NewPasswordForm />
    </>
  )
}
