import Link from 'next/link'
import { CookieSettingsLink } from '@/components/legal/cookie-consent'
import { InstagramIcon, TikTokIcon, XIcon } from '@/components/ui/icons'
import { company, site } from '@/lib/config/site'
import type { Category } from '@/lib/types'

export function Footer({ categories }: { categories: Pick<Category, 'slug' | 'name'>[] }) {
  const columns = [
    {
      title: 'Comprar',
      links: [
        { href: '/tienda', label: 'Todos los kits' },
        ...categories.map((c) => ({ href: `/categoria/${c.slug}`, label: c.name })),
        { href: '/tienda?orden=novedades', label: 'Novedades' },
      ],
    },
    {
      title: 'Ayuda',
      links: [
        { href: '/legal/envios', label: 'Envíos' },
        { href: '/legal/devoluciones', label: 'Cambios y devoluciones' },
        { href: '/contacto', label: 'Contacto' },
        { href: '/#como-funciona', label: 'Cómo funciona' },
      ],
    },
    {
      title: 'Tu cuenta',
      links: [
        { href: '/cuenta', label: 'Mi cuenta' },
        { href: '/cuenta/pedidos', label: 'Mis pedidos' },
        { href: '/cuenta/direcciones', label: 'Direcciones' },
        { href: '/cesta', label: 'Cesta' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { href: '/legal/aviso-legal', label: 'Aviso legal' },
        { href: '/legal/privacidad', label: 'Privacidad' },
        { href: '/legal/cookies', label: 'Cookies' },
        { href: '/legal/condiciones', label: 'Condiciones de compra' },
      ],
    },
  ]

  return (
    <footer className="bg-mist text-[12px] text-ash-ink">
      <div className="container-page py-12">
        <p className="border-b border-line-strong/60 pb-5 leading-relaxed">
          Precios con IVA incluido. Envío gratis en pedidos desde 40 € a Península y Baleares. Los kits de nivel 1 y 2 son 100 % secos
          (tú pones agua y aceite) y los de nivel 3 incluyen ingredientes frescos y se envían refrigerados. Cada kit trae su receta con QR. Recomendamos que los menores de 14 años cocinen
          con la supervisión de un adulto.
        </p>

        <nav aria-label="Pie de página" className="grid grid-cols-2 gap-8 py-8 sm:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="mb-3 text-[12px] font-semibold text-ink">{col.title}</h2>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-ink hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-4 border-t border-line-strong/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Copyright © {new Date().getFullYear()} {company.legalName ?? site.name}. Todos los derechos reservados.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <CookieSettingsLink className="hover:text-ink hover:underline" />
            <Link href="/legal/privacidad" className="hover:text-ink hover:underline">
              Privacidad
            </Link>
            <Link href="/legal/aviso-legal" className="hover:text-ink hover:underline">
              Aviso legal
            </Link>
            <a href={site.social.instagram} className="hover:text-ink" aria-label="Instagram de Hambre de Más" rel="noopener noreferrer" target="_blank">
              <InstagramIcon size={18} />
            </a>
            <a href={site.social.tiktok} className="hover:text-ink" aria-label="TikTok de Hambre de Más" rel="noopener noreferrer" target="_blank">
              <TikTokIcon size={18} />
            </a>
            <a href={site.social.x} className="hover:text-ink" aria-label="X (Twitter) de Hambre de Más" rel="noopener noreferrer" target="_blank">
              <XIcon size={17} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
