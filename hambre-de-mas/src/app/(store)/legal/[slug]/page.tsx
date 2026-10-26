import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LegalNotice, legalPages } from '@/components/legal/legal-content'

type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(legalPages).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = legalPages[(await params).slug]
  return page ? { title: page.title, description: page.description, alternates: { canonical: `/legal/${(await params).slug}` } } : {}
}

export default async function LegalPage({ params }: Props) {
  const page = legalPages[(await params).slug]
  if (!page) notFound()
  return (
    <article className="container-page max-w-3xl pt-12 pb-24">
      <p className="eyebrow">Información legal</p>
      <h1 className="mt-3 mb-8 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{page.title}</h1>
      <LegalNotice />
      <div className="prose-store">{page.body()}</div>
      <p className="mt-12 text-xs text-ash-ink">
        Texto base orientativo. No sustituye el asesoramiento jurídico: revísalo con un profesional antes de publicar la tienda.
      </p>
    </article>
  )
}
