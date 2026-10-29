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
  description: string | null
  image: string
  kits: number
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
 * Niveles en paneles que se despliegan: el panel activo se abre a lo ancho
 * con su foto, descripción, número de kits y kit estrella; los demás quedan
 * estrechos con el nombre en vertical. Se abre al pasar el ratón, al
 * enfocar con el teclado o al tocar. En móvil, tarjetas apiladas.
 */
export function LevelsShowcase({ slides }: { slides: LevelSlide[] }) {
  const { t } = useI18n()
  const [active, setActive] = useState(0)

  return (
    <section aria-labelledby="niveles" className="container-page py-20 sm:py-24">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <h2 id="niveles" className="max-w-2xl font-display text-[36px] leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl">
          {t({ es: 'Tres niveles.', en: 'Three levels.' })}{' '}
          <span className="text-chef">{t({ es: 'Un kit para cada momento.', en: 'A kit for every moment.' })}</span>
        </h2>
        <p className="max-w-md text-[17px] leading-relaxed text-ash-ink">
          {t({
            es: 'Empiezas sin encender el fuego, pasas a la sartén y acabas cocinando recetas del mundo. Cada kit desbloquea el siguiente.',
            en: 'Start without turning on the hob, move on to the pan and end up cooking world recipes. Each kit unlocks the next.',
          })}
        </p>
      </div>

      <ul className="mt-10 flex flex-col gap-3 lg:h-[560px] lg:flex-row">
        {slides.map((s, i) => {
          const open = i === active
          const tag = s.level ? t({ es: `Nivel ${s.level}`, en: `Level ${s.level}` }) : t({ es: 'Cada mes', en: 'Every month' })
          return (
            <li
              key={s.slug}
              data-open={open}
              onMouseEnter={() => setActive(i)}
              onFocusCapture={() => setActive(i)}
              onClick={() => setActive(i)}
              className={cn(
                'group relative isolate h-[420px] overflow-hidden rounded-[32px] bg-ink text-white transition-[flex-grow] duration-700 ease-[var(--ease-apple)] lg:h-auto lg:min-w-[92px]',
                open ? 'lg:flex-[5]' : 'lg:flex-[1]',
              )}
            >
              <Image
                src={s.image}
                alt=""
                fill
                sizes="(min-width: 1024px) 70vw, 100vw"
                quality={85}
                className={cn('-z-10 object-cover transition-[transform,filter] duration-700', open ? 'scale-100' : 'lg:scale-110 lg:brightness-[0.55] lg:saturate-50')}
              />
              <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

              {/* Cerrado (solo escritorio): nivel y nombre en vertical */}
              <div className={cn('absolute inset-0 hidden flex-col items-center justify-between py-7 transition-opacity duration-300 lg:flex', open ? 'pointer-events-none opacity-0' : 'opacity-100')}>
                <span className="grid size-11 place-items-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur-md">
                  {s.level ? <LevelBars level={s.level} /> : <GiftIcon size={18} />}
                </span>
                <span className="font-display text-2xl font-extrabold whitespace-nowrap [writing-mode:vertical-rl] rotate-180">{s.name}</span>
              </div>

              {/* Abierto */}
              <div
                className={cn(
                  'absolute inset-0 flex flex-col justify-between p-6 transition-[opacity,transform] duration-500 sm:p-8',
                  open ? 'opacity-100 lg:translate-y-0 lg:delay-200' : 'lg:pointer-events-none lg:translate-y-4 lg:opacity-0',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] font-semibold ring-1 ring-white/25 backdrop-blur-md">
                    {s.level ? <LevelBars level={s.level} /> : <GiftIcon size={16} />}
                    {tag}
                  </span>
                  {s.level && (
                    <span aria-hidden className="font-display text-[88px] leading-none font-extrabold text-white/15 sm:text-[120px]">
                      0{s.level}
                    </span>
                  )}
                </div>
                <div className="max-w-xl">
                  <h3 className="font-display text-[34px] leading-tight font-extrabold sm:text-[44px]">{s.name}</h3>
                  {s.tagline && <p className="mt-1 text-[15px] font-medium text-almendra">{s.tagline}</p>}
                  {s.description && <p className="mt-3 hidden text-[15px] leading-relaxed text-white/80 sm:block">{s.description}</p>}
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/categoria/${s.slug}`}
                      className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-ink transition-colors hover:bg-almendra"
                    >
                      {s.kits === 1 ? t({ es: 'Ver el kit', en: 'See the kit' }) : t({ es: `Ver ${s.kits} kits`, en: `See ${s.kits} kits` })} <ArrowRightIcon size={16} />
                    </Link>
                    {s.product && s.kits > 1 && (
                      <Link
                        href={`/producto/${s.product.slug}`}
                        className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-5 text-[14px] text-white ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-white/20"
                      >
                        <span className="text-white/60">{t({ es: 'Estrella:', en: 'Top pick:' })}</span>
                        <span className="font-semibold">{s.product.name}</span>
                        <span className="text-white/70 tabular-nums">{s.product.price}</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
