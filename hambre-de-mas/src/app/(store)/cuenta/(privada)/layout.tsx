import { signOut } from '@/app/actions/auth'
import { AccountNav } from '@/components/account/account-nav'
import { getProfile, requireUser } from '@/lib/auth/session'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/cuenta')
  const profile = await getProfile()
  const firstName = profile?.fullName?.split(' ')[0]
  return (
    <div className="container-page pt-10 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-8">
        <div>
          <p className="eyebrow">Tu cuenta</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{firstName ? `Hola, ${firstName}.` : 'Hola.'}</h1>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-sm text-ash-ink hover:text-teja">
            Cerrar sesión
          </button>
        </form>
      </header>
      <div className="mt-8 grid gap-10 lg:grid-cols-[200px_1fr]">
        <AccountNav isAdmin={profile?.role === 'admin'} />
        <div>{children}</div>
      </div>
    </div>
  )
}
