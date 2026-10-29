import Link from 'next/link'
import { CookieSettingsLink } from '@/components/legal/cookie-consent'
import { InstagramIcon, TikTokIcon, XIcon } from '@/components/ui/icons'
import { company, site } from '@/lib/config/site'
import { getI18n } from '@/lib/i18n/server'
import type { Category } from '@/lib/types'
import { LocaleSwitcher } from './locale-switcher'

export async function Footer({ categories }: { categories: Pick<Category, 'slug' | 'name'>[] }) {
  const { t } = await getI18n()
  const columns = [
    {
      title: t({ es: 'Comprar', en: 'Shop' }),
      links: [
        { href: '/tienda', label: t({ es: 'Todos los kits', en: 'All kits' }) },
        ...categories.map((c) => ({ href: `/categoria/${c.slug}`, label: c.name })),
        { href: '/tienda?orden=novedades', label: t({ es: 'Novedades', en: 'New arrivals' }) },
      ],
    },
    {
      title: t({ es: 'Ayuda', en: 'Help' }),
      links: [
        { href: '/legal/envios', label: t({ es: 'Envíos', en: 'Shipping' }) },
        { href: '/legal/devoluciones', label: t({ es: 'Cambios y devoluciones', en: 'Returns and exchanges' }) },
        { href: '/contacto', label: t({ es: 'Contacto', en: 'Contact' }) },
        { href: '/#como-funciona', label: t({ es: 'Cómo funciona', en: 'How it works' }) },
        ...(company.email ? [{ href: `mailto:${company.email}`, label: company.email }] : []),
      ],
    },
    {
      title: t({ es: 'Tu cuenta', en: 'Your account' }),
      links: [
        { href: '/cuenta', label: t({ es: 'Mi cuenta', en: 'My account' }) },
        { href: '/cuenta/pedidos', label: t({ es: 'Mis pedidos', en: 'My orders' }) },
        { href: '/cuenta/direcciones', label: t({ es: 'Direcciones', en: 'Addresses' }) },
        { href: '/cesta', label: t({ es: 'Cesta', en: 'Bag' }) },
      ],
    },
    {
      title: 'Legal',
      links: [
        { href: '/legal/aviso-legal', label: t({ es: 'Aviso legal', en: 'Legal notice' }) },
        { href: '/legal/privacidad', label: t({ es: 'Privacidad', en: 'Privacy' }) },
        { href: '/legal/cookies', label: 'Cookies' },
        { href: '/legal/condiciones', label: t({ es: 'Condiciones de compra', en: 'Terms of sale' }) },
      ],
    },
  ]

  return (
    <footer className="bg-mist text-[12px] text-ash-ink">
      <div className="container-page py-12">
        <p className="border-b border-line-strong/60 pb-5 leading-relaxed">
          {t({
            es: 'Precios con IVA incluido. Envío gratis en pedidos desde 40 € a Península y Baleares. Los kits de nivel 1 y 2 son 100 % secos (tú pones agua y aceite) y los de nivel 3 incluyen ingredientes frescos y se envían refrigerados. Cada kit trae su receta con QR. Recomendamos que los menores de 14 años cocinen con la supervisión de un adulto.',
            en: 'Prices include VAT. Free shipping on orders from €40 to mainland Spain and the Balearic Islands. Level 1 and 2 kits are 100% dry (you add water and oil); level 3 kits include fresh ingredients and ship chilled. Every kit comes with a QR recipe. We recommend that under-14s cook with an adult around.',
          })}
        </p>

        <nav aria-label={t({ es: 'Pie de página', en: 'Footer' })} className="grid grid-cols-2 gap-8 py-8 sm:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="mb-3 text-[12px] font-semibold text-ink">{col.title}</h2>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    {link.href.startsWith('mailto:') ? (
                      <a href={link.href} className="break-all text-teja hover:underline">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="hover:text-ink hover:underline">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-4 border-t border-line-strong/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Copyright © {new Date().getFullYear()} {company.legalName ?? site.name}. {t({ es: 'Todos los derechos reservados.', en: 'All rights reserved.' })}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <CookieSettingsLink className="hover:text-ink hover:underline" />
            <LocaleSwitcher variant="segmented" />
            <Link href="/legal/privacidad" className="hover:text-ink hover:underline">
              {t({ es: 'Privacidad', en: 'Privacy' })}
            </Link>
            <Link href="/legal/aviso-legal" className="hover:text-ink hover:underline">
              {t({ es: 'Aviso legal', en: 'Legal notice' })}
            </Link>
            <a href={site.social.instagram} className="hover:text-ink" aria-label={t({ es: 'Instagram de Hambre de Más', en: 'Hambre de Más on Instagram' })} rel="noopener noreferrer" target="_blank">
              <InstagramIcon size={18} />
            </a>
            <a href={site.social.tiktok} className="hover:text-ink" aria-label={t({ es: 'TikTok de Hambre de Más', en: 'Hambre de Más on TikTok' })} rel="noopener noreferrer" target="_blank">
              <TikTokIcon size={18} />
            </a>
            <a href={site.social.x} className="hover:text-ink" aria-label={t({ es: 'X (Twitter) de Hambre de Más', en: 'Hambre de Más on X (Twitter)' })} rel="noopener noreferrer" target="_blank">
              <XIcon size={17} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
