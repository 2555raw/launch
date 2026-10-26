'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

export function AccountNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()
  const links = [
    { href: '/cuenta', label: 'Mis datos' },
    { href: '/cuenta/pedidos', label: 'Mis pedidos' },
    { href: '/cuenta/direcciones', label: 'Direcciones' },
    ...(isAdmin ? [{ href: '/admin', label: 'Panel de administración' }] : []),
  ]
  return (
    <nav aria-label="Cuenta">
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
