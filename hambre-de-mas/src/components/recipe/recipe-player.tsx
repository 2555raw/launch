'use client'

import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, CloseIcon, PlayIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'

/** `ingredient`: foto pequeña del ingrediente que nombra el paso (se muestra en un círculo, no a pantalla completa). */
export type PlayerStep = { title: string; text: string; ingredient: string | null }

/** Segundos que se queda cada paso: lo que se tarda en leerlo con calma (entre 7 y 16 s). */
const stepSeconds = (text: string) => Math.min(16, Math.max(7, Math.round(text.split(/\s+/).length / 2.6)))

/** Primer tiempo que menciona el paso («3 minutos», «90 segundos», «10 min»), en segundos. */
function timerFrom(text: string) {
  const m = text.match(/(\d+)\s*(minutos?|min\b|minutes?|segundos?|seconds?)/i)
  if (!m) return null
  const n = Number(m[1])
  return /^seg|^sec/i.test(m[2]!) ? n : n * 60
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * Modo vídeo de la receta: los pasos a pantalla completa, como historias.
 * Avanza solo (se puede pausar), con la foto del ingrediente de cada paso,
 * temporizador si el paso dice cuánto tarda y la pantalla sin apagarse.
 */
export function RecipePlayer({
  dish,
  steps,
  backgrounds,
  productSlug,
  variant = 'light',
}: {
  dish: string
  steps: PlayerStep[]
  /** Fotos grandes del plato; se van alternando de fondo. */
  backgrounds: string[]
  productSlug: string
  variant?: 'light' | 'dark'
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [timer, setTimer] = useState<{ left: number; running: boolean } | null>(null)
  const progressRef = useRef(0)
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null)
  const finished = index >= steps.length
  const step = steps[index]

  const go = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(steps.length, next)))
      progressRef.current = 0
      setProgress(0)
      setTimer(null)
    },
    [steps.length],
  )

  // Avance automático (se para en pausa o con el temporizador en marcha)
  const timerRunning = timer?.running ?? false
  useEffect(() => {
    if (!open || paused || finished || timerRunning || !step) return
    const total = stepSeconds(step.text) * 1000
    const started = performance.now() - progressRef.current * total
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / total)
      progressRef.current = p
      setProgress(p)
      if (p >= 1) go(index + 1)
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open, paused, finished, timerRunning, step, index, go])

  // Temporizador del paso
  useEffect(() => {
    if (!timerRunning) return
    const id = setInterval(() => {
      setTimer((prev) => {
        if (!prev) return prev
        if (prev.left <= 1) {
          try {
            navigator.vibrate?.([200, 100, 200])
          } catch {}
          return { left: 0, running: false }
        }
        return { ...prev, left: prev.left - 1 }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [timerRunning])

  // Teclado y scroll bloqueado mientras está abierto
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      else if (e.key === 'ArrowRight') go(index + 1)
      else if (e.key === 'ArrowLeft') go(index - 1)
      else if (e.key === ' ') {
        e.preventDefault()
        setPaused((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, index, go])

  // Pantalla encendida mientras cocinas (si el navegador lo permite)
  useEffect(() => {
    if (!open) return
    const nav = navigator as Navigator & {
      wakeLock?: {
        request: (type: 'screen') => Promise<{ release: () => Promise<void> }>
      }
    }
    nav.wakeLock
      ?.request('screen')
      .then((lock) => {
        wakeLock.current = lock
      })
      .catch(() => {})
    return () => {
      wakeLock.current?.release().catch(() => {})
      wakeLock.current = null
    }
  }, [open])

  const start = () => {
    go(0)
    setPaused(false)
    setOpen(true)
  }

  const stepTimer = step ? timerFrom(step.text) : null
  const background = backgrounds.length ? backgrounds[(finished ? 0 : index) % backgrounds.length] : null

  return (
    <>
      <button
        type="button"
        onClick={start}
        className={cn(
          'inline-flex h-12 items-center gap-2.5 rounded-full pr-6 pl-1.5 text-[15px] font-semibold transition-transform hover:scale-[1.03]',
          variant === 'dark' ? 'bg-white text-ink' : 'bg-ink text-white',
        )}
      >
        <span className={cn('grid size-9 place-items-center rounded-full', variant === 'dark' ? 'bg-chef-ink text-white' : 'bg-white text-ink')}>
          <PlayIcon size={18} />
        </span>
        {t({ es: 'Modo vídeo', en: 'Video mode' })}
      </button>

      {/* En un portal: la cabecera animada de la receta crearía un contenedor que recorta el «fixed» */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <MotionConfig reducedMotion="user">
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label={t({
                    es: `Receta de ${dish} en modo vídeo`,
                    en: `${dish} recipe in video mode`,
                  })}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[90] overflow-hidden bg-ink text-white"
                >
                  {/* Fondo: foto del paso con zoom lento */}
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={finished ? 'fin' : index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6 }}
                      className="absolute inset-0"
                    >
                      {background && (
                        <motion.div
                          className="absolute inset-0"
                          initial={{ scale: 1.08, x: index % 2 ? '-2%' : '2%' }}
                          animate={{ scale: 1.22, x: index % 2 ? '2%' : '-2%' }}
                          transition={{ duration: 18, ease: 'linear' }}
                        >
                          <ProductImage src={background} alt="" fill sizes="100vw" className="object-cover" />
                        </motion.div>
                      )}
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/60" />
                    </motion.div>
                  </AnimatePresence>

                  <div className="relative mx-auto flex h-full max-w-2xl flex-col px-5 pt-4 pb-8 sm:pt-6">
                    {/* Barras de progreso */}
                    <div className="flex gap-1.5" aria-hidden>
                      {steps.map((s, i) => (
                        <span key={s.title} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                          <span
                            className="block h-full rounded-full bg-white"
                            style={{
                              width: `${i < index ? 100 : i === index ? progress * 100 : 0}%`,
                            }}
                          />
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">
                        {dish}
                        {!finished && (
                          <span className="text-white/60">
                            {' '}
                            ·{' '}
                            {t({
                              es: `Paso ${index + 1} de ${steps.length}`,
                              en: `Step ${index + 1} of ${steps.length}`,
                            })}
                          </span>
                        )}
                      </p>
                      <div className="relative z-10 flex items-center gap-1">
                        {!finished && (
                          <button
                            type="button"
                            onClick={() => setPaused((p) => !p)}
                            className="grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur"
                            aria-label={paused ? t({ es: 'Seguir', en: 'Resume' }) : t({ es: 'Pausar', en: 'Pause' })}
                          >
                            {paused ? (
                              <PlayIcon size={18} />
                            ) : (
                              <span aria-hidden className="flex gap-1">
                                <span className="h-3.5 w-1 rounded-full bg-white" />
                                <span className="h-3.5 w-1 rounded-full bg-white" />
                              </span>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setOpen(false)}
                          className="grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur"
                          aria-label={t({ es: 'Cerrar', en: 'Close' })}
                        >
                          <CloseIcon size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Zonas para tocar: izquierda atrás, derecha adelante */}
                    {!finished && (
                      <>
                        <button type="button" tabIndex={-1} aria-hidden onClick={() => go(index - 1)} className="absolute inset-y-24 left-0 w-1/3" />
                        <button type="button" tabIndex={-1} aria-hidden onClick={() => go(index + 1)} className="absolute inset-y-24 right-0 w-1/3" />
                      </>
                    )}

                    <div className="pointer-events-none relative mt-auto" aria-live="polite">
                      <AnimatePresence mode="wait">
                        {!finished && step ? (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{
                              duration: 0.45,
                              ease: [0.28, 0.11, 0.32, 1],
                            }}
                          >
                            <div className="flex items-end gap-4">
                              <span className="font-display text-[88px] leading-none font-extrabold text-chef sm:text-[120px]">{index + 1}</span>
                              {step.ingredient && (
                                <motion.span
                                  initial={{ scale: 0, rotate: -12 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 18 }}
                                  className="relative mb-2 block size-16 overflow-hidden rounded-full ring-4 ring-white/90 sm:size-20"
                                >
                                  <ProductImage src={step.ingredient} alt="" fill sizes="80px" className="object-cover" />
                                </motion.span>
                              )}
                            </div>
                            <h2 className="mt-2 font-display text-4xl leading-tight font-extrabold sm:text-5xl">{step.title}</h2>
                            <p className="mt-4 text-xl leading-relaxed text-white/90 sm:text-2xl">{step.text}</p>
                          </motion.div>
                        ) : (
                          <motion.div key="fin" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
                            <h2 className="mt-4 font-display text-5xl font-extrabold">
                              {t({
                                es: '¡Listo! Que aproveche.',
                                en: 'Done! Enjoy.',
                              })}
                            </h2>
                            <p className="mt-3 text-xl text-white/80">
                              {t({
                                es: 'Has completado la receta. ¿Repetimos o subes de nivel?',
                                en: 'You finished the recipe. Cook it again or level up?',
                              })}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="relative mt-8 flex flex-wrap items-center gap-3">
                      {!finished && stepTimer ? (
                        <button
                          type="button"
                          onClick={() =>
                            setTimer((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    running: prev.left > 0 && !prev.running,
                                  }
                                : { left: stepTimer, running: true },
                            )
                          }
                          className={cn(
                            'inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-semibold tabular-nums',
                            timer?.left === 0 ? 'bg-hoja text-ink' : 'bg-white text-ink',
                          )}
                        >
                          <ClockIcon size={18} />
                          {timer
                            ? timer.left === 0
                              ? t({ es: '¡Tiempo!', en: 'Time’s up!' })
                              : `${clock(timer.left)}${timer.running ? '' : ` · ${t({ es: 'seguir', en: 'resume' })}`}`
                            : t({
                                es: `Temporizador ${clock(stepTimer)}`,
                                en: `Timer ${clock(stepTimer)}`,
                              })}
                        </button>
                      ) : null}
                      {finished ? (
                        <>
                          <button
                            type="button"
                            onClick={() => go(0)}
                            className="inline-flex h-12 items-center rounded-full bg-white px-6 font-semibold text-ink"
                          >
                            {t({ es: 'Verla otra vez', en: 'Watch again' })}
                          </button>
                          <Link href={`/producto/${productSlug}`} className="inline-flex h-12 items-center rounded-full bg-chef-ink px-6 font-semibold">
                            {t({ es: 'Ver el kit', en: 'See the kit' })}
                          </Link>
                        </>
                      ) : (
                        <div className="ml-auto flex gap-2">
                          <button
                            type="button"
                            onClick={() => go(index - 1)}
                            disabled={index === 0}
                            className="grid size-12 place-items-center rounded-full bg-white/15 backdrop-blur disabled:opacity-40"
                            aria-label={t({
                              es: 'Paso anterior',
                              en: 'Previous step',
                            })}
                          >
                            <ChevronLeftIcon />
                          </button>
                          <button
                            type="button"
                            onClick={() => go(index + 1)}
                            className="grid size-12 place-items-center rounded-full bg-white text-ink"
                            aria-label={t({
                              es: 'Paso siguiente',
                              en: 'Next step',
                            })}
                          >
                            <ChevronRightIcon />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </MotionConfig>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
