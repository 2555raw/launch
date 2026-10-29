import type { Metadata } from 'next'
import { LevelQuiz, type QuizKit, type QuizLevel } from '@/components/quiz/level-quiz'
import { getCatalog } from '@/lib/catalog'
import { getI18n } from '@/lib/i18n/server'
import { formatPrice } from '@/lib/money'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return {
    title: t({ es: '¿Qué nivel eres?', en: 'Which level are you?' }),
    description: t({
      es: 'Cuatro preguntas y te decimos por qué nivel empezar y qué kit te va.',
      en: 'Four questions and we’ll tell you which level to start with and which kit suits you.',
    }),
    alternates: { canonical: '/test-nivel' },
  }
}

export default async function LevelQuizPage() {
  const catalog = getCatalog()
  const { locale, t } = await getI18n()
  const [categories, products] = await Promise.all([catalog.listCategories(), catalog.listProducts({ sort: 'popular', limit: 100 })])
  const levels: QuizLevel[] = categories.flatMap((c) =>
    c.level ? [{ slug: c.slug, level: c.level, name: c.name, tagline: c.tagline, description: c.description }] : [],
  )
  const kits: QuizKit[] = products.items.flatMap((p) =>
    p.category?.level && p.totalStock > 0
      ? [
          {
            slug: p.slug,
            name: p.name,
            level: p.category.level,
            tags: p.tags,
            minutes: p.attributes.minutes ?? null,
            image: p.image?.url ?? null,
            price: formatPrice(p.priceCents, locale),
          },
        ]
      : [],
  )
  return (
    <div className="container-page pt-12 pb-24">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">{t({ es: 'Test', en: 'Quiz' })}</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
          {t({ es: '¿Qué nivel eres?', en: 'Which level are you?' })}{' '}
          <span className="text-chef">{t({ es: 'Cuatro preguntas.', en: 'Four questions.' })}</span>
        </h1>
        <p className="mt-4 text-lg text-ash-ink">
          {t({ es: 'Te decimos por dónde empezar y qué kit te va más.', en: 'We’ll tell you where to start and which kit suits you best.' })}
        </p>
      </div>
      <div className="mt-12">
        <LevelQuiz levels={levels} kits={kits} />
      </div>
    </div>
  )
}
