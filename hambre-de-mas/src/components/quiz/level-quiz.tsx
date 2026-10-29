'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { LevelBars } from '@/components/home/levels-showcase'
import { buttonClass } from '@/components/ui/button'
import { ArrowRightIcon, ChevronLeftIcon, ClockIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'
import type { Localized } from '@/lib/i18n/config'

export type QuizLevel = { slug: string; level: number; name: string; tagline: string | null; description: string | null }
export type QuizKit = { slug: string; name: string; level: number; tags: string[]; minutes: number | null; image: string | null; price: string }

type Answer = { label: Localized<string>; photo: string; score?: number; pref?: string }
type Question = { id: string; title: Localized<string>; answers: Answer[] }

const QUESTIONS: Question[] = [
  {
    id: 'experiencia',
    title: { es: '¿Has cocinado alguna vez?', en: 'Have you ever cooked?' },
    answers: [
      { score: 0, photo: '/demo/ingredients/huevos.jpg', label: { es: 'Nunca, ni un huevo frito', en: 'Never, not even a fried egg' } },
      { score: 1, photo: '/demo/products/tostadas-1.jpg', label: { es: 'Alguna cosa sencilla', en: 'A few simple things' } },
      { score: 2, photo: '/demo/products/pizza-1.jpg', label: { es: 'Me defiendo bastante bien', en: 'I can hold my own' } },
    ],
  },
  {
    id: 'cocina',
    title: { es: '¿Qué puedes usar en tu cocina?', en: 'What can you use in your kitchen?' },
    answers: [
      { score: 0, photo: '/demo/products/mug-cake-1.jpg', label: { es: 'Solo el microondas (o nada)', en: 'Just the microwave (or nothing)' } },
      { score: 1, photo: '/demo/products/pad-thai-1.jpg', label: { es: 'Fuego: sartén y cazo', en: 'The hob: pan and pot' } },
      { score: 2, photo: '/demo/products/pizza-2.jpg', label: { es: 'De todo, también el horno', en: 'Everything, oven included' } },
    ],
  },
  {
    id: 'tiempo',
    title: { es: '¿Cuánto tiempo quieres pasar cocinando?', en: 'How long do you want to spend cooking?' },
    answers: [
      { score: 0, pref: 'rapido', photo: '/demo/products/parfait-1.jpg', label: { es: 'Menos de 15 minutos', en: 'Under 15 minutes' } },
      { score: 1, photo: '/demo/products/tacos-1.jpg', label: { es: 'Entre 20 y 30 minutos', en: '20 to 30 minutes' } },
      { score: 2, photo: '/demo/products/gyozas-1.jpg', label: { es: 'Lo que haga falta', en: 'As long as it takes' } },
    ],
  },
  {
    id: 'antojo',
    title: { es: '¿Qué te apetece más?', en: 'What are you craving?' },
    answers: [
      { pref: 'picante', photo: '/demo/ingredients/chile.jpg', label: { es: 'Algo picante', en: 'Something spicy' } },
      { pref: 'vegetariano', photo: '/demo/ingredients/verduras-frescas.jpg', label: { es: 'Sin carne', en: 'No meat' } },
      { pref: 'alto-en-proteina', photo: '/demo/products/burger-1.jpg', label: { es: 'Mucha proteína', en: 'Lots of protein' } },
      { photo: '/demo/products/sorpresa-1.jpg', label: { es: 'Me da igual, sorpréndeme', en: 'Anything, surprise me' } },
    ],
  },
]

/** Nivel recomendado: sin fuego siempre empieza en el 1; si no, por la suma de experiencia, cocina y tiempo. */
function levelFor(answers: Answer[]) {
  const [experience, kitchen, time] = answers.map((a) => a.score ?? 0)
  if (kitchen === 0) return 1
  const score = (experience ?? 0) + (kitchen ?? 0) + (time ?? 0)
  return score >= 5 ? 3 : score >= 2 ? 2 : 1
}

function kitsFor(kits: QuizKit[], level: number, answers: Answer[]) {
  const prefs = answers.flatMap((a) => (a.pref ? [a.pref] : []))
  const matches = (k: QuizKit, pref: string) =>
    pref === 'rapido' ? (k.minutes ?? 99) <= 15 : pref === 'vegetariano' ? k.tags.includes('vegetariano') || k.tags.includes('vegano') : k.tags.includes(pref)
  const inLevel = kits.filter((k) => k.level === level)
  // Primero los que cumplen más preferencias; a igualdad, el orden de entrada (los más vendidos)
  return [...inLevel].sort((a, b) => prefs.filter((p) => matches(b, p)).length - prefs.filter((p) => matches(a, p)).length).slice(0, 3)
}

export function LevelQuiz({ levels, kits }: { levels: QuizLevel[]; kits: QuizKit[] }) {
  const { t } = useI18n()
  const [answers, setAnswers] = useState<Answer[]>([])
  const step = answers.length
  const done = step >= QUESTIONS.length
  const question = QUESTIONS[step]

  const level = done ? levelFor(answers) : null
  const result = level ? levels.find((l) => l.level === level) : null
  const picks = level ? kitsFor(kits, level, answers) : []

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progreso */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {QUESTIONS.map((q, i) => (
            <span key={q.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
              <motion.span
                className="block h-full rounded-full bg-chef-ink"
                initial={false}
                animate={{ width: i < step ? '100%' : '0%' }}
                transition={{ duration: 0.4, ease: [0.28, 0.11, 0.32, 1] }}
              />
            </span>
          ))}
        </div>
        <span className="text-xs text-ash-ink tabular-nums">
          {done ? t({ es: '¡Listo!', en: 'Done!' }) : `${step + 1}/${QUESTIONS.length}`}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {!done && question ? (
          <motion.section
            key={question.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3, ease: [0.28, 0.11, 0.32, 1] }}
            className="mt-10"
            aria-live="polite"
          >
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{t(question.title)}</h2>
            <ul className={cn('mt-8 grid gap-3', question.answers.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3')}>
              {question.answers.map((a) => (
                <li key={a.label.es}>
                  <button
                    type="button"
                    onClick={() => setAnswers((prev) => [...prev, a])}
                    className="group flex h-full w-full flex-col overflow-hidden rounded-[22px] border-2 border-line bg-white text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-ink"
                  >
                    <span className="relative block aspect-[16/10] w-full overflow-hidden bg-mist">
                      <Image src={a.photo} alt="" fill sizes="(min-width: 640px) 240px, 90vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                    </span>
                    <span className="p-4 text-[16px] font-semibold">{t(a.label)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {step > 0 && (
              <button type="button" onClick={() => setAnswers((prev) => prev.slice(0, -1))} className="mt-6 inline-flex items-center gap-1 text-sm text-ash-ink hover:text-ink">
                <ChevronLeftIcon size={16} /> {t({ es: 'Anterior', en: 'Back' })}
              </button>
            )}
          </motion.section>
        ) : result ? (
          <motion.section
            key="resultado"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.28, 0.11, 0.32, 1] }}
            className="mt-10"
            aria-live="polite"
          >
            <div className="rounded-[32px] bg-ink p-7 text-white sm:p-10">
              <p className="inline-flex items-center gap-2 text-sm text-white/70">
                <span className="text-chef">
                  <LevelBars level={result.level} />
                </span>
                {t({ es: 'Tu nivel es', en: 'Your level is' })}
              </p>
              <h2 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">{result.name}</h2>
              {result.tagline && <p className="mt-2 font-medium text-almendra">{result.tagline}</p>}
              {result.description && <p className="mt-4 max-w-xl text-white/75">{result.description}</p>}
            </div>

            {picks.length > 0 && (
              <>
                <h3 className="mt-10 font-display text-2xl font-bold">{t({ es: 'Tus kits para empezar', en: 'Your kits to start with' })}</h3>
                <ul className="mt-5 grid gap-4 sm:grid-cols-3">
                  {picks.map((k, i) => (
                    <motion.li key={k.slug} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }}>
                      <Link href={`/producto/${k.slug}`} className="group block overflow-hidden rounded-[22px] bg-white ring-1 ring-line">
                        <div className="relative aspect-[4/3] bg-mist">
                          {k.image && <ProductImage src={k.image} alt="" fill sizes="240px" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
                          {i === 0 && (
                            <span className="absolute top-3 left-3 rounded-full bg-chef-ink px-2.5 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
                              {t({ es: 'El tuyo', en: 'Your match' })}
                            </span>
                          )}
                        </div>
                        <div className="p-4">
                          <p className="font-semibold leading-snug">{k.name}</p>
                          <p className="mt-1 flex items-center gap-2 text-sm text-ash-ink">
                            {t({ es: 'Desde', en: 'From' })} {k.price}
                            {k.minutes ? (
                              <span className="inline-flex items-center gap-1">
                                · <ClockIcon size={13} /> {k.minutes} min
                              </span>
                            ) : null}
                          </p>
                        </div>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/categoria/${result.slug}`} className={buttonClass('primary', 'lg')}>
                {t({ es: `Ver todos los kits ${result.name}`, en: `See all ${result.name} kits` })} <ArrowRightIcon size={16} />
              </Link>
              <button type="button" onClick={() => setAnswers([])} className={buttonClass('secondary', 'lg')}>
                {t({ es: 'Repetir el test', en: 'Take it again' })}
              </button>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
