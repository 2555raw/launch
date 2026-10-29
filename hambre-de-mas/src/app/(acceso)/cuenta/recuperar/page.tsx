import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthHeading, ResetRequestForm } from '@/components/account/auth-forms'
import { AuthStage } from '@/components/account/auth-stage'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t({ es: 'Recuperar contraseña', en: 'Reset password' }), robots: { index: false } }
}

export default async function ResetRequestPage() {
  const { t } = await getI18n()
  return (
    <AuthStage>
      <div className="px-7 pt-7 pb-6">
        <AuthHeading
          title={t({ es: '¿Contraseña olvidada?', en: 'Forgot your password?' })}
          lead={t({ es: 'Escribe tu email y te mandamos un enlace para crear otra.', en: "Enter your email and we'll send you a link to create a new one." })}
        />
        <ResetRequestForm />
        <p className="mt-6 text-center text-sm">
          <Link href="/cuenta/acceder" className="font-semibold text-teja underline-offset-2 hover:underline">
            {t({ es: 'Volver a iniciar sesión', en: 'Back to sign in' })}
          </Link>
        </p>
      </div>
    </AuthStage>
  )
}
