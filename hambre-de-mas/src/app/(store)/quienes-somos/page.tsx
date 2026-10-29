import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Reveal } from '@/components/motion/reveal'
import { ReviewAuthor } from '@/components/product/review-author'
import { buttonClass } from '@/components/ui/button'
import { ArrowRightIcon, JarIcon, QrIcon, ShieldIcon, StarIcon } from '@/components/ui/icons'
import { ALLERGENS } from '@/lib/allergens'
import { getCatalog, isDemoMode } from '@/lib/catalog'
import { team } from '@/lib/config/team'
import { getI18n } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n()
  return {
    title: t({ es: 'Quiénes somos', en: 'About us' }),
    description: t({
      es: 'Por qué existe Hambre de Más: kits de cocina para que aprender a cocinar sea tan enganchante como subir de nivel.',
      en: 'Why Hambre de Más exists: cooking kits that make learning to cook as addictive as levelling up.',
    }),
    alternates: { canonical: '/quienes-somos' },
  }
}

export default async function AboutPage() {
  const { t } = await getI18n()
  const catalog = getCatalog()
  const [categories, products] = await Promise.all([catalog.listCategories(), catalog.listProducts({ limit: 1 })])
  const levels = categories.filter((c) => c.level).length

  const values = [
    {
      icon: JarIcon,
      title: t({ es: 'Todo medido', en: 'Everything measured' }),
      text: t({
        es: 'Cada kit trae la cantidad justa de cada ingrediente. Nada de comprar un bote entero para usar una cucharada.',
        en: 'Every kit has exactly the amount of each ingredient you need. No buying a whole jar to use one spoonful.',
      }),
    },
    {
      icon: StarIcon,
      title: t({ es: 'Aprender jugando', en: 'Learn by playing' }),
      text: t({
        es: 'Tres niveles, como en un videojuego: empiezas sin fuego y acabas cocinando recetas del mundo.',
        en: 'Three levels, like a video game: you start with no heat and end up cooking world recipes.',
      }),
    },
    {
      icon: QrIcon,
      title: t({ es: 'La receta en el móvil', en: 'The recipe on your phone' }),
      text: t({
        es: 'Un QR en cada caja abre la receta paso a paso, con un modo vídeo que avanza solo mientras cocinas.',
        en: 'A QR code in every box opens the step-by-step recipe, with a video mode that moves on while you cook.',
      }),
    },
    {
      icon: ShieldIcon,
      title: t({ es: 'Seguridad primero', en: 'Safety first' }),
      text: t({
        es: `Los ${ALLERGENS.length} alérgenos marcados en cada kit y consejos de seguridad en cada receta.`,
        en: `All ${ALLERGENS.length} allergens flagged on every kit and safety tips in every recipe.`,
      }),
    },
  ]

  const stats = [
    { value: products.total, label: t({ es: 'kits', en: 'kits' }) },
    { value: levels, label: t({ es: 'niveles', en: 'levels' }) },
    { value: ALLERGENS.length, label: t({ es: 'alérgenos indicados', en: 'allergens flagged' }) },
    { value: 0, label: t({ es: 'listas de la compra imposibles', en: 'impossible shopping lists' }) },
  ]

  return (
    <>
      <div className="container-page pt-12 pb-16">
        <p className="eyebrow">{t({ es: 'Quiénes somos', en: 'About us' })}</p>
        <h1 className="mt-3 max-w-4xl font-display text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
          {t({ es: 'Cocinar no debería dar miedo.', en: 'Cooking shouldn’t be scary.' })}{' '}
          <span className="text-chef">{t({ es: 'Debería engancharte.', en: 'It should hook you.' })}</span>
        </h1>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="space-y-5 text-[17px] leading-relaxed text-ink/80">
              <p>
                {t({
                  es: 'Hambre de Más nace de algo que nos pasaba a casi todos: queríamos cocinar, pero las recetas de internet daban por hecho que tenías media despensa en casa, y la lista de la compra era más larga que la propia receta.',
                  en: 'Hambre de Más was born from something that happened to almost all of us: we wanted to cook, but online recipes assumed you had half a pantry at home, and the shopping list was longer than the recipe itself.',
                })}
              </p>
              <p>
                {t({
                  es: 'Así que pensamos en una caja con todo lo necesario ya medido, una receta que se entiende a la primera y una forma de ir mejorando poco a poco. Como en un videojuego: superas un nivel y desbloqueas el siguiente.',
                  en: 'So we imagined a box with everything you need already measured, a recipe you understand first time, and a way to get better bit by bit. Like a video game: beat a level and unlock the next one.',
                })}
              </p>
              <p>
                {t({
                  es: 'Lo hemos pensado para adolescentes que quieren espabilarse en la cocina, para quien vive solo por primera vez y para cualquiera con más hambre que experiencia.',
                  en: 'We designed it for teens who want to get going in the kitchen, for people living alone for the first time, and for anyone with more hunger than experience.',
                })}
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[32px] bg-mist shadow-float">
              <Image
                src="/demo/home/cocinando.jpg"
                alt={t({ es: 'Una chica salteando verduras en una sartén', en: 'A girl stir-frying vegetables in a pan' })}
                fill
                sizes="(min-width: 1024px) 45vw, 92vw"
                className="object-cover"
              />
            </div>
          </Reveal>
        </div>
      </div>

      <section aria-labelledby="valores" className="bg-mist py-16">
        <div className="container-page">
          <h2 id="valores" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t({ es: 'En qué creemos.', en: 'What we believe in.' })}
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <li key={v.title} className="rounded-[24px] bg-white p-6">
                <span className="grid size-11 place-items-center rounded-2xl bg-almendra-soft text-teja">
                  <v.icon size={22} />
                </span>
                <p className="mt-4 font-display text-lg font-bold">{v.title}</p>
                <p className="mt-1 text-[15px] text-ash-ink">{v.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label={t({ es: 'En cifras', en: 'In numbers' })} className="container-page py-16">
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col-reverse rounded-[24px] bg-ink p-6 text-white">
              <dt className="text-sm text-white/70">{s.label}</dt>
              <dd className="font-display text-5xl font-extrabold">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {team.length > 0 && (
        <section aria-labelledby="equipo" className="container-page pb-16">
          <h2 id="equipo" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t({ es: 'El equipo.', en: 'The team.' })}
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((m) => (
              <li key={m.name} className="rounded-[24px] bg-mist p-6">
                <ReviewAuthor name={m.name} verifiedLabel={null} meta={<span>{t(m.role)}</span>} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="container-page pb-24">
        <div className="rounded-[32px] bg-almendra-soft p-8 sm:p-12">
          {isDemoMode() && (
            <p className="mb-3 text-sm font-semibold text-teja">{t({ es: 'Proyecto de fin de curso', en: 'End-of-year school project' })}</p>
          )}
          <p className="max-w-2xl font-display text-2xl leading-tight font-bold sm:text-3xl">
            {t({ es: '¿Te animas a subir de nivel?', en: 'Ready to level up?' })}{' '}
            <span className="text-chef">{t({ es: 'Empieza por saber cuál es el tuyo.', en: 'Start by finding out which one is yours.' })}</span>
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/test-nivel" className={buttonClass('primary', 'lg')}>
              {t({ es: 'Hacer el test', en: 'Take the quiz' })} <ArrowRightIcon size={16} />
            </Link>
            <Link href="/tienda" className={buttonClass('secondary', 'lg')}>
              {t({ es: 'Ver la tienda', en: 'Browse the shop' })}
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
