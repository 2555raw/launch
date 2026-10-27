import type { Metadata } from 'next'
import Link from 'next/link'
import { ClockIcon, InstagramIcon, ReturnIcon, TruckIcon } from '@/components/ui/icons'
import { company, site } from '@/lib/config/site'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return {
    title: t({ es: 'Contacto', en: 'Contact' }),
    description: t({
      es: 'Escríbenos si tienes dudas sobre un kit, un pedido o una devolución.',
      en: 'Write to us if you have questions about a kit, an order or a return.',
    }),
    alternates: { canonical: '/contacto' },
  }
}

export default async function ContactPage() {
  const { locale, t } = await getI18n()
  return (
    <div className="container-page pt-12 pb-24">
      <p className="eyebrow">{t({ es: 'Contacto', en: 'Contact' })}</p>
      <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
        {t({ es: '¿Hablamos?', en: "Let's talk." })} <span className="text-chef">{t({ es: 'Te respondemos rápido.', en: "We'll get back to you fast." })}</span>
      </h1>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        <div className="rounded-[24px] bg-mist p-6">
          <p className="font-display text-xl font-bold">{t({ es: 'Escríbenos', en: 'Write to us' })}</p>
          {company.email ? (
            <a href={`mailto:${company.email}`} className="mt-2 block text-lg text-teja hover:underline">
              {company.email}
            </a>
          ) : (
            <p className="mt-2 text-sm text-teja">{t({ es: '[PENDIENTE: email de contacto]', en: '[PENDING: contact email]' })}</p>
          )}
          {company.phone && <p className="mt-1 text-ash-ink">{company.phone}</p>}
          <p className="mt-4 flex items-center gap-2 text-sm text-ash-ink">
            <ClockIcon size={16} /> {locale === 'en' ? (company.supportHoursEn ?? company.supportHours) : company.supportHours}
          </p>
        </div>
        <div className="rounded-[24px] bg-mist p-6">
          <p className="font-display text-xl font-bold">{t({ es: 'Tu pedido', en: 'Your order' })}</p>
          <p className="mt-2 text-sm text-ash-ink">
            {t({
              es: 'Consulta el estado y el seguimiento en tu cuenta. Si escribes, indica el número de pedido (HDM-…).',
              en: 'Check its status and tracking in your account. If you write to us, include your order number (HDM-…).',
            })}
          </p>
          <Link href="/cuenta/pedidos" className="mt-4 inline-flex items-center gap-2 text-sm text-teja hover:underline">
            <TruckIcon size={16} /> {t({ es: 'Mis pedidos', en: 'My orders' })}
          </Link>
        </div>
        <div className="rounded-[24px] bg-mist p-6">
          <p className="font-display text-xl font-bold">{t({ es: 'Devoluciones', en: 'Returns' })}</p>
          <p className="mt-2 text-sm text-ash-ink">
            {t({
              es: 'Kits sin abrir, 14 días desde la entrega. Te explicamos cómo en la página de devoluciones.',
              en: 'Unopened kits, within 14 days of delivery. The returns page explains how.',
            })}
          </p>
          <Link href="/legal/devoluciones" className="mt-4 inline-flex items-center gap-2 text-sm text-teja hover:underline">
            <ReturnIcon size={16} /> {t({ es: 'Cambios y devoluciones', en: 'Returns and exchanges' })}
          </Link>
        </div>
      </div>
      <p className="mt-10 flex items-center gap-2 text-sm text-ash-ink">
        <InstagramIcon size={18} /> {t({ es: 'También estamos en', en: "We're also on" })}{' '}
        <a href={site.social.instagram} className="text-teja hover:underline" rel="noopener noreferrer" target="_blank">
          Instagram
        </a>{' '}
        {t({ es: 'y', en: 'and' })}{' '}
        <a href={site.social.tiktok} className="text-teja hover:underline" rel="noopener noreferrer" target="_blank">
          TikTok
        </a>
        .
      </p>
    </div>
  )
}
