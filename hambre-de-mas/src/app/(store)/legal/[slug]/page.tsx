import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LegalNotice, legalPages } from '@/components/legal/legal-content'
import { getI18n } from '@/lib/i18n/server'

type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(legalPages).map((slug) => ({ slug }))
}

/** Títulos en inglés. El texto legal solo existe en español (es la versión que vale). */
const titlesEn: Record<string, string> = {
  'aviso-legal': 'Legal notice',
  privacidad: 'Privacy policy',
  cookies: 'Cookie policy',
  condiciones: 'Terms of sale',
  envios: 'Shipping',
  devoluciones: 'Returns and exchanges',
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug
  const page = legalPages[slug]
  const { locale } = await getI18n()
  if (!page) return {}
  return {
    title: locale === 'en' ? (titlesEn[slug] ?? page.title) : page.title,
    description: page.description,
    alternates: { canonical: `/legal/${slug}` },
  }
}

export default async function LegalPage({ params }: Props) {
  const slug = (await params).slug
  const page = legalPages[slug]
  if (!page) notFound()
  const { locale, t } = await getI18n()
  return (
    <article className="container-page max-w-3xl pt-12 pb-24">
      <p className="eyebrow">{t({ es: 'Información legal', en: 'Legal information' })}</p>
      <h1 className="mt-3 mb-8 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        {locale === 'en' ? (titlesEn[slug] ?? page.title) : page.title}
      </h1>
      {locale === 'en' && (
        <p className="mb-8 rounded-2xl bg-mist px-5 py-4 text-sm text-ink/80">
          These legal texts are only available in Spanish, which is the binding version. If you need help understanding anything, contact us and
          we&apos;ll explain it in English.
        </p>
      )}
      <LegalNotice />
      <div className="prose-store" lang="es">
        {page.body()}
      </div>
      <p className="mt-12 text-xs text-ash-ink">
        {t({
          es: 'Texto base orientativo. No sustituye el asesoramiento jurídico: revísalo con un profesional antes de publicar la tienda.',
          en: 'Template text for guidance only. It is not legal advice: have a professional review it before the shop goes live.',
        })}
      </p>
    </article>
  )
}
