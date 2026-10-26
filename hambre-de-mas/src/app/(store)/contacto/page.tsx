import type { Metadata } from 'next'
import Link from 'next/link'
import { ClockIcon, InstagramIcon, ReturnIcon, TruckIcon } from '@/components/ui/icons'
import { company, site } from '@/lib/config/site'

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Escríbenos si tienes dudas sobre un kit, un pedido o una devolución.',
  alternates: { canonical: '/contacto' },
}

export default function ContactPage() {
  return (
    <div className="container-page pt-12 pb-24">
      <p className="eyebrow">Contacto</p>
      <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
        ¿Hablamos? <span className="text-ash">Te respondemos rápido.</span>
      </h1>
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        <div className="rounded-[24px] bg-mist p-6">
          <p className="font-display text-xl font-bold">Escríbenos</p>
          {company.email ? (
            <a href={`mailto:${company.email}`} className="mt-2 block text-lg text-teja hover:underline">
              {company.email}
            </a>
          ) : (
            <p className="mt-2 text-sm text-teja">[PENDIENTE: email de contacto]</p>
          )}
          {company.phone && <p className="mt-1 text-ash-ink">{company.phone}</p>}
          <p className="mt-4 flex items-center gap-2 text-sm text-ash-ink">
            <ClockIcon size={16} /> {company.supportHours}
          </p>
        </div>
        <div className="rounded-[24px] bg-mist p-6">
          <p className="font-display text-xl font-bold">Tu pedido</p>
          <p className="mt-2 text-sm text-ash-ink">Consulta el estado y el seguimiento en tu cuenta. Si escribes, indica el número de pedido (HDM-…).</p>
          <Link href="/cuenta/pedidos" className="mt-4 inline-flex items-center gap-2 text-sm text-teja hover:underline">
            <TruckIcon size={16} /> Mis pedidos
          </Link>
        </div>
        <div className="rounded-[24px] bg-mist p-6">
          <p className="font-display text-xl font-bold">Devoluciones</p>
          <p className="mt-2 text-sm text-ash-ink">Kits sin abrir, 14 días desde la entrega. Te explicamos cómo en la página de devoluciones.</p>
          <Link href="/legal/devoluciones" className="mt-4 inline-flex items-center gap-2 text-sm text-teja hover:underline">
            <ReturnIcon size={16} /> Cambios y devoluciones
          </Link>
        </div>
      </div>
      <p className="mt-10 flex items-center gap-2 text-sm text-ash-ink">
        <InstagramIcon size={18} /> También estamos en{' '}
        <a href={site.social.instagram} className="text-teja hover:underline" rel="noopener noreferrer" target="_blank">
          Instagram
        </a>{' '}
        y{' '}
        <a href={site.social.tiktok} className="text-teja hover:underline" rel="noopener noreferrer" target="_blank">
          TikTok
        </a>
        .
      </p>
    </div>
  )
}
