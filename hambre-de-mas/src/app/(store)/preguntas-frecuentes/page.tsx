import type { Metadata } from 'next'
import Link from 'next/link'
import { JsonLd } from '@/components/seo/json-ld'
import { ChevronDownIcon } from '@/components/ui/icons'
import { FAQS } from '@/lib/assistant/faq'
import { company } from '@/lib/config/site'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return {
    title: t({ es: 'Preguntas frecuentes', en: 'FAQ' }),
    description: t({
      es: 'Niveles, envíos, alérgenos, pagos, regalos y todo lo que nos soléis preguntar sobre los kits de Hambre de Más.',
      en: 'Levels, shipping, allergens, payments, gifts and everything you usually ask about Hambre de Más kits.',
    }),
    alternates: { canonical: '/preguntas-frecuentes' },
  }
}

/** Las mismas preguntas que usa el panel de ayuda (src/lib/assistant/faq.ts), en acordeón. */
export default async function FaqPage() {
  const { locale, t } = await getI18n()
  return (
    <div className="container-page pt-12 pb-24">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQS.map((f) => ({
            '@type': 'Question',
            name: f.question[locale],
            acceptedAnswer: { '@type': 'Answer', text: f.answer[locale] },
          })),
        }}
      />
      <p className="eyebrow">{t({ es: 'Ayuda', en: 'Help' })}</p>
      <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
        {t({ es: 'Preguntas frecuentes.', en: 'FAQ.' })} <span className="text-chef">{t({ es: 'Lo que más nos preguntáis.', en: 'What you ask us most.' })}</span>
      </h1>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_320px]">
        <ul className="divide-y divide-line border-y border-line">
          {FAQS.map((f, i) => (
            <li key={f.id} id={f.id} className="scroll-mt-24">
              <details className="group" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left font-display text-lg font-bold sm:text-xl [&::-webkit-details-marker]:hidden">
                  {f.question[locale]}
                  <ChevronDownIcon size={20} className="shrink-0 text-ash transition-transform duration-300 group-open:rotate-180" />
                </summary>
                <p className="max-w-3xl pb-6 text-[16px] leading-relaxed text-ink/80">{f.answer[locale]}</p>
              </details>
            </li>
          ))}
        </ul>

        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="rounded-[24px] bg-almendra-soft p-6">
            <p className="font-display text-xl font-bold">{t({ es: '¿No sabes qué nivel elegir?', en: 'Not sure which level to pick?' })}</p>
            <p className="mt-2 text-sm text-ink/75">
              {t({ es: 'Responde cuatro preguntas y te recomendamos tu nivel y un kit.', en: 'Answer four questions and we’ll recommend your level and a kit.' })}
            </p>
            <Link href="/test-nivel" className="mt-4 inline-flex h-11 items-center rounded-full bg-chef-ink px-5 text-sm font-semibold text-white hover:bg-teja">
              {t({ es: 'Hacer el test', en: 'Take the quiz' })}
            </Link>
          </div>
          <div className="rounded-[24px] bg-mist p-6">
            <p className="font-display text-xl font-bold">{t({ es: '¿Otra duda?', en: 'Another question?' })}</p>
            <p className="mt-2 text-sm text-ash-ink">
              {t({ es: 'Pregunta al asistente (abajo a la derecha) o escríbenos.', en: 'Ask the assistant (bottom right) or write to us.' })}
            </p>
            <Link href="/contacto" className="mt-3 inline-block text-sm font-semibold text-teja hover:underline">
              {company.email ?? t({ es: 'Contacto', en: 'Contact' })}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
