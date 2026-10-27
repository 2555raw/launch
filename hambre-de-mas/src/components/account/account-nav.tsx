'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'

export function AccountNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const { t } = useI18n()
  const links = [
    { href: '/cuenta', label: t({ es: 'Mis datos', en: 'My details' }) },
    { href: '/cuenta/pedidos', label: t({ es: 'Mis pedidos', en: 'My orders' }) },
    { href: '/cuenta/direcciones', label: t({ es: 'Direcciones', en: 'Addresses' }) },
    ...(isAdmin ? [{ href: '/admin', label: t({ es: 'Panel de administración', en: 'Admin panel' }) }] : []),
  ]
  return (
    <nav aria-label={t({ es: 'Cuenta', en: 'Account' })}>
      <ul className="scrollbar-none flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
        {links.map((l) => {
          const active = l.href === '/cuenta' ? pathname === l.href : pathname.startsWith(l.href)
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors lg:rounded-xl',
                  active ? 'bg-ink text-white' : 'text-ink/80 hover:bg-mist',
                )}
              >
                {l.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
