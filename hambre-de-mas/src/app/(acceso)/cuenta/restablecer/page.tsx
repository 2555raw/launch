import type { Metadata } from 'next'
import { AuthHeading, NewPasswordForm } from '@/components/account/auth-forms'
import { AuthStage } from '@/components/account/auth-stage'
import { requireUser } from '@/lib/auth/session'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t({ es: 'Nueva contraseña', en: 'New password' }), robots: { index: false } }
}

export default async function NewPasswordPage() {
  // El enlace del email ya ha iniciado sesión (ruta /auth/confirm).
  await requireUser('/cuenta/restablecer')
  const { t } = await getI18n()
  return (
    <AuthStage>
      <div className="px-7 pt-7 pb-6">
        <AuthHeading
          title={t({ es: 'Nueva contraseña', en: 'New password' })}
          lead={t({ es: 'Elige una que no uses en otros sitios.', en: "Pick one you don't use anywhere else." })}
        />
        <NewPasswordForm />
      </div>
    </AuthStage>
  )
}
