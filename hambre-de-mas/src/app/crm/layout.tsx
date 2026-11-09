import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/layout/logo'
import { requireAdmin } from '@/lib/auth/session'
import { isDemoMode } from '@/lib/catalog'
import { I18nProvider } from '@/lib/i18n/client'

export const metadata: Metadata = {
  title: { default: 'CRM', template: '%s · CRM · Hambre de Más' },
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

/**
 * CRM de clientes. Con base de datos es solo para administradores; en la vista
 * previa (sin base de datos) se abre sin cuenta y enseña clientes de ejemplo.
 */
export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const demo = isDemoMode()
  if (!demo) await requireAdmin('/crm')
  return (
    <I18nProvider locale="es">
      <div className="min-h-dvh bg-mist" lang="es">
        <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Logo />
              <Link href="/crm" className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-white">
                CRM
              </Link>
              {demo && <span className="rounded-full bg-almendra px-2.5 py-0.5 text-[11px] font-semibold text-teja">Datos de ejemplo</span>}
            </div>
            <nav className="flex items-center gap-4 text-sm">
              {!demo && (
                <Link href="/admin" className="text-ash-ink hover:text-ink">
                  Panel
                </Link>
              )}
              <Link href="/" className="text-teja hover:underline">
                Ver tienda
              </Link>
            </nav>
          </div>
        </header>
        <main id="contenido" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
          {children}
        </main>
      </div>
    </I18nProvider>
  )
}
