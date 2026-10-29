import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthDivider, AuthHeading, SignUpForm, SocialButtons } from '@/components/account/auth-forms'
import { hasSocialProviders } from '@/lib/auth/providers'
import { AuthStage } from '@/components/account/auth-stage'
import { safeNext } from '@/lib/auth/session'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t({ es: 'Crear cuenta', en: 'Create account' }), robots: { index: false } }
}

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  const target = safeNext(next)
  const { t } = await getI18n()
  return (
    <AuthStage wide>
      <div className="px-7 pt-7 pb-6">
        <AuthHeading
          title={t({ es: 'Crear cuenta', en: 'Create account' })}
          lead={t({
            es: 'Sigue tus pedidos, guarda direcciones y recibe kits para tu nivel. Tardas un minuto.',
            en: 'Track orders, save addresses and get kits for your level. It takes a minute.',
          })}
        />
        {hasSocialProviders && (
          <>
            <SocialButtons next={target} />
            <AuthDivider />
          </>
        )}
        <SignUpForm next={target} />
        <p className="mt-6 text-center text-sm text-ash-ink">
          {t({ es: '¿Ya tienes cuenta?', en: 'Already have an account?' })}{' '}
          <Link href={`/cuenta/acceder?next=${encodeURIComponent(target)}`} className="font-semibold text-teja underline-offset-2 hover:underline">
            {t({ es: 'Inicia sesión', en: 'Sign in' })}
          </Link>
        </p>
      </div>
    </AuthStage>
  )
}
