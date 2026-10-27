import type { Metadata } from 'next'
import { ProfileForm } from '@/components/account/profile-form'
import { getProfile } from '@/lib/auth/session'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return { title: t({ es: 'Mi cuenta', en: 'My account' }), robots: { index: false } }
}

export default async function AccountPage() {
  const profile = await getProfile()
  const { t } = await getI18n()
  return (
    <section aria-labelledby="perfil" className="max-w-xl">
      <h2 id="perfil" className="font-display text-2xl font-bold">
        {t({ es: 'Tus datos', en: 'Your details' })}
      </h2>
      <p className="mt-1 mb-6 text-sm text-ash-ink">
        {t({ es: 'Email de acceso', en: 'Login email' })}: {profile?.email}
      </p>
      <ProfileForm
        fullName={profile?.fullName ?? ''}
        phone={profile?.phone ?? ''}
        marketingOptIn={profile?.marketingOptIn ?? false}
        cookingLevel={profile?.cookingLevel ?? null}
        avoidAllergens={profile?.avoidAllergens ?? []}
      />
    </section>
  )
}
