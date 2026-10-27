import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthDivider, AuthHeading, SignInForm, SocialButtons } from '@/components/account/auth-forms'
import { hasSocialProviders } from '@/lib/auth/providers'
import { AuthStage } from '@/components/account/auth-stage'
import { safeNext } from '@/lib/auth/session'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t({ es: 'Iniciar sesión', en: 'Sign in' }), robots: { index: false } }
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  const target = safeNext(next)
  const { t } = await getI18n()
  return (
    <AuthStage>
      <div className="px-7 pt-7 pb-6">
        <AuthHeading title={t({ es: 'Iniciar sesión', en: 'Sign in' })} lead={t({ es: 'Entra para ver tus pedidos y comprar más rápido.', en: 'Sign in to see your orders and check out faster.' })} />
        {error && (
          <p className="mb-4 rounded-xl bg-chef/15 px-4 py-3 text-sm text-[#ffb3a8] ring-1 ring-chef/30" role="alert">
            {error === 'proveedor'
              ? t({ es: 'No hemos podido entrar con esa cuenta. Prueba con tu email.', en: "We couldn't sign you in with that account. Try your email instead." })
              : t({ es: 'El enlace no es válido o ha caducado. Inténtalo de nuevo.', en: 'The link is invalid or has expired. Please try again.' })}
          </p>
        )}
        <SignInForm next={target} />
        {hasSocialProviders && (
          <>
            <AuthDivider />
            <SocialButtons next={target} />
          </>
        )}
        <p className="mt-6 text-center text-sm text-white/55">
          {t({ es: '¿Primera vez por aquí?', en: 'New here?' })}{' '}
          <Link href={`/cuenta/registro?next=${encodeURIComponent(target)}`} className="font-semibold text-white underline-offset-2 hover:underline">
            {t({ es: 'Crea tu cuenta', en: 'Create an account' })}
          </Link>
        </p>
      </div>
    </AuthStage>
  )
}
