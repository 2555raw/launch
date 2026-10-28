'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowRightIcon, GiftIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'

export type LevelSlide = {
  slug: string
  level: number | null
  name: string
  tagline: string | null
  image: string
  product: { name: string; slug: string; price: string } | null
}

/** Tres barras que se llenan según el nivel. */
export function LevelBars({ level }: { level: number }) {
  return (
    <span aria-hidden className="flex items-end gap-[3px]">
      {[1, 2, 3].map((n) => (
        <span key={n} className={cn('w-[5px] rounded-full', n <= level ? 'bg-current' : 'bg-current opacity-25')} style={{ height: 6 + n * 4 }} />
      ))}
    </span>
  )
}

/**
 * Niveles en escaparate: a la izquierda, un botón por nivel; a la derecha, la
 * foto del kit más vendido de ese nivel. El botón activo rellena una barra y,
 * al terminar, pasa solo al siguiente (se para al pasar el ratón por encima
 * y con «reducir movimiento»). El estado va en atributos data-active para que
 * la animación sea CSS.
 */
export function LevelsShowcase({ slides }: { slides: LevelSlide[] }) {
  const { t } = useI18n()
  const [active, setActive] = useState(0)
  const current = slides[active] ?? slides[0]
  if (!current) return null
  const next = () => setActive((i) => (i + 1) % slides.length)

  return (
    <section aria-labelledby="niveles" className="levels-showcase relative isolate overflow-hidden bg-[#141110] text-white" data-levels>
      {/* Fondo: la foto activa, desenfocada */}
      <div aria-hidden className="absolute inset-0 -z-10">
        {slides.map((s, i) => (
          <Image
            key={s.slug}
            src={s.image}
            alt=""
            fill
            sizes="100vw"
            quality={70}
            data-active={i === active}
            data-slide={i}
            className="scale-125 object-cover opacity-0 blur-3xl transition-opacity duration-1000 data-[active=true]:opacity-60"
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/30" />
      </div>

      <div className="container-page grid items-center gap-14 py-20 sm:py-24 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:py-28">
        <div>
          <h2 id="niveles" className="font-display text-[40px] leading-[1.04] font-extrabold tracking-tight text-balance sm:text-[56px]">
            {t({ es: 'Tres niveles.', en: 'Three levels.' })}
            <br />
            {t({ es: 'Un kit para cada momento.', en: 'A kit for every moment.' })}
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/70">
            {t({
              es: 'Empiezas sin encender el fuego, pasas a la sartén y acabas cocinando recetas del mundo con ingredientes frescos. Y si te va la sorpresa, un kit nuevo cada mes.',
              en: 'Start without turning on the hob, move on to the pan and end up cooking world recipes with fresh ingredients. And if you like surprises, a new kit every month.',
            })}
          </p>

          <ul className="mt-10 flex flex-wrap gap-3" role="tablist" aria-label={t({ es: 'Niveles', en: 'Levels' })}>
            {slides.map((s, i) => (
              <li key={s.slug} role="presentation">
                <button
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-controls="nivel-activo"
                  data-active={i === active}
                  data-chip={i}
                  data-slug={s.slug}
                  onClick={() => setActive(i)}
                  className="group relative flex h-14 items-center gap-3 overflow-hidden rounded-full bg-white/[0.06] px-6 text-[17px] font-medium text-white/60 ring-1 ring-white/10 backdrop-blur-md transition-[background-color,color,box-shadow] duration-300 hover:text-white data-[active=true]:bg-white/[0.14] data-[active=true]:text-white data-[active=true]:ring-white/25"
                >
                  {s.level ? <LevelBars level={s.level} /> : <GiftIcon size={20} />}
                  {s.level ? t({ es: `Nivel ${s.level}`, en: `Level ${s.level}` }) : s.name}
                  <span
                    aria-hidden
                    onAnimationEnd={next}
                    className="levels-progress absolute inset-x-6 bottom-[7px] h-[3px] origin-left rounded-full bg-chef"
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[620px] pb-8">
          <Link
            href={`/categoria/${current.slug}`}
            id="nivel-activo"
            role="tabpanel"
            data-card
            className="group relative block aspect-[3/2] overflow-hidden rounded-[32px] bg-black/30 shadow-[0_40px_120px_-30px_rgb(0_0_0/0.8)] ring-1 ring-white/15"
          >
            {slides.map((s, i) => (
              <Image
                key={s.slug}
                src={s.image}
                alt={i === active ? s.name : ''}
                fill
                sizes="(min-width: 1024px) 620px, 92vw"
                quality={85}
                data-active={i === active}
                data-slide={i}
                className="scale-105 object-cover opacity-0 transition-[opacity,transform] duration-700 ease-[var(--ease-apple)] data-[active=true]:scale-100 data-[active=true]:opacity-100"
              />
            ))}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-chef-ink/80 via-chef-ink/10 to-black/25" />
            <span className="absolute top-6 left-6 flex items-center gap-2.5">
              <span className="grid size-11 place-items-center rounded-full bg-white">
                <Image src="/brand/logo-320.png" alt="" width={320} height={290} className="h-8 w-auto" />
              </span>
            </span>
            {slides.map((s, i) => (
              <span
                key={s.slug}
                data-active={i === active}
                data-slide={i}
                className="absolute right-6 bottom-12 left-6 translate-y-2 opacity-0 transition-[opacity,transform] duration-500 data-[active=true]:translate-y-0 data-[active=true]:opacity-100"
              >
                <span className="block font-display text-3xl font-extrabold sm:text-4xl">{s.name}</span>
                <span className="mt-1 hidden text-[15px] text-white/80 sm:block">{s.tagline}</span>
              </span>
            ))}
          </Link>

          {/* Etiqueta flotante con el kit más vendido del nivel */}
          {slides.map((s, i) =>
            s.product ? (
              <Link
                key={s.slug}
                href={`/producto/${s.product.slug}`}
                data-active={i === active}
                data-slide={i}
                tabIndex={i === active ? 0 : -1}
                aria-hidden={i !== active}
                className="pointer-events-none absolute bottom-0 left-1/2 flex -translate-x-1/2 translate-y-2 items-center gap-3 rounded-full bg-white/15 py-3.5 pr-6 pl-5 whitespace-nowrap text-white opacity-0 shadow-[0_20px_50px_-15px_rgb(0_0_0/0.6)] ring-1 ring-white/25 backdrop-blur-xl transition-[opacity,transform] duration-500 data-[active=true]:pointer-events-auto data-[active=true]:translate-y-0 data-[active=true]:opacity-100"
              >
                <span className="text-[15px] font-semibold">{s.product.name}</span>
                <span className="text-[15px] text-white/70 tabular-nums">{s.product.price}</span>
                <ArrowRightIcon size={16} className="text-white/70" />
              </Link>
            ) : null,
          )}
        </div>
      </div>
    </section>
  )
}
