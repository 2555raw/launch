import type { Metadata } from 'next'
import { ProfileForm } from '@/components/account/profile-form'
import { getProfile } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Mi cuenta', robots: { index: false } }

export default async function AccountPage() {
  const profile = await getProfile()
  return (
    <section aria-labelledby="perfil" className="max-w-xl">
      <h2 id="perfil" className="font-display text-2xl font-bold">
        Tus datos
      </h2>
      <p className="mt-1 mb-6 text-sm text-ash-ink">Email de acceso: {profile?.email}</p>
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
