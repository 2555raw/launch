'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

const links = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/productos', label: 'Productos' },
  { href: '/admin/inventario', label: 'Inventario' },
  { href: '/admin/categorias', label: 'Categorías' },
  { href: '/admin/promociones', label: 'Promociones' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/encargos', label: 'Encargos' },
  { href: '/admin/opiniones', label: 'Opiniones' },
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Panel">
      <ul className="scrollbar-none flex gap-1 overflow-x-auto lg:flex-col">
        {links.map((l) => {
          const active = l.href === '/admin' ? pathname === l.href : pathname.startsWith(l.href)
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-xl px-3.5 py-2 text-sm whitespace-nowrap transition-colors',
                  active ? 'bg-ink font-medium text-white' : 'text-ink/75 hover:bg-mist hover:text-ink',
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
