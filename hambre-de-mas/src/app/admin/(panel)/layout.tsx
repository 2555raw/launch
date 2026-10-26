import type { Metadata } from 'next'
import Link from 'next/link'
import { signOut } from '@/app/actions/auth'
import { AdminNav } from '@/components/admin/admin-nav'
import { Logo } from '@/components/layout/logo'
import { requireAdmin } from '@/lib/auth/session'

export const metadata: Metadata = { title: { default: 'Panel', template: '%s · Panel · Hambre de Más' }, robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin()
  return (
    <div className="min-h-dvh bg-mist">
      <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-white">Panel</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-ash-ink sm:inline">{profile.email}</span>
            <Link href="/" className="text-teja hover:underline">
              Ver tienda
            </Link>
            <form action={signOut}>
              <button className="text-ash-ink hover:text-ink">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <div className="grid gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[200px_1fr] lg:gap-10 lg:py-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AdminNav />
        </aside>
        <main id="contenido" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
