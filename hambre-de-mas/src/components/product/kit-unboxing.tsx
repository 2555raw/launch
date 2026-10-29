'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import { useState } from 'react'
import { QrIcon, SnowflakeIcon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n/client'
import { classifyKitItem, SachetIcon } from './kit-contents'

const spring = { type: 'spring', stiffness: 260, damping: 22 } as const

type Piece = { key: string; label: string; photo: string | null; kind: ReturnType<typeof classifyKitItem> | 'frio' }

/** Una pieza del kit fuera de la caja: sobre, bote, fresco, acumulador de frío o la tarjeta del QR. */
function PieceCard({ piece, qrSvg }: { piece: Piece; qrSvg: string | null }) {
  const photo = piece.photo && (
    <span className="relative mx-auto block size-12 overflow-hidden rounded-full bg-mist ring-2 ring-white sm:size-14">
      <Image src={piece.photo} alt="" fill sizes="56px" className="object-cover" />
    </span>
  )
  const label = <span className="mt-1.5 line-clamp-2 block text-center text-[10px] leading-tight font-semibold sm:text-[11px]">{piece.label}</span>

  if (piece.kind === 'tarjeta') {
    return (
      <div className="flex h-full flex-col rounded-xl bg-white p-2 shadow-float ring-1 ring-line">
        {qrSvg ? (
          <span className="mx-auto block w-14 [&_svg]:h-auto [&_svg]:w-full sm:w-16" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        ) : (
          <QrIcon size={40} className="mx-auto text-ink" />
        )}
        {label}
      </div>
    )
  }
  if (piece.kind === 'frio') {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl bg-gradient-to-b from-[#CFE6F7] to-[#9CC9EC] p-2 text-[#14507A] shadow-float">
        <SnowflakeIcon size={26} />
        {label}
      </div>
    )
  }
  if (piece.kind === 'fresco') {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-float ring-1 ring-[#9CC9EC]">
        <span className="flex items-center justify-center gap-1 bg-[#E4F1FB] py-0.5 text-[9px] font-bold tracking-wider text-[#14507A] uppercase">
          <SnowflakeIcon size={10} /> 0–4 ºC
        </span>
        <span className="flex flex-1 flex-col justify-center p-2">
          {photo}
          {label}
        </span>
      </div>
    )
  }
  if (piece.kind === 'sobre') {
    // Sobrecito con el borde de arriba dentado
    return (
      <div className="flex h-full flex-col justify-center bg-almendra p-2 pt-3 text-teja shadow-float [clip-path:polygon(0_6%,8%_0,16%_6%,25%_0,33%_6%,41%_0,50%_6%,58%_0,66%_6%,75%_0,83%_6%,91%_0,100%_6%,100%_100%,0_100%)] rounded-b-xl">
        {photo ?? <SachetIcon size={34} className="mx-auto" />}
        {label}
      </div>
    )
  }
  // De despensa: bote o paquete con tapa de color
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white shadow-float ring-1 ring-line">
      <span className="h-2 bg-chef" />
      <span className="flex flex-1 flex-col justify-center p-2">
        {photo}
        {label}
      </span>
    </div>
  )
}

/**
 * «Así te llega»: la caja del kit con su nombre y nivel. Al abrirla, la tapa
 * sale volando y las piezas del kit saltan una a una y se colocan en orden,
 * cada una como viene empaquetada. Con «reducir movimiento», sin animación.
 */
export function KitUnboxing({
  name,
  level,
  levelName,
  items,
  images = [],
  storage,
  qrSvg,
}: {
  name: string
  level: number | null
  levelName: string | null
  items: string[]
  images?: (string | null)[]
  storage?: 'seco' | 'fresco'
  qrSvg: string | null
}) {
  const { t } = useI18n()
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const fresh = storage === 'fresco'
  const shortName = name.replace(/^kit\s+/i, '').replace(/\s+kit$/i, '')

  const pieces: Piece[] = [
    ...items.map((label, i) => ({ key: `${i}-${label}`, label, photo: images[i] ?? null, kind: classifyKitItem(label, storage) })),
    ...(fresh
      ? [
          { key: 'frio-1', label: t({ es: 'Acumulador de frío', en: 'Ice pack' }), photo: null, kind: 'frio' as const },
          { key: 'frio-2', label: t({ es: 'Acumulador de frío', en: 'Ice pack' }), photo: null, kind: 'frio' as const },
        ]
      : []),
  ]
  // La tarjeta del QR, siempre la última
  pieces.sort((a, b) => Number(a.kind === 'tarjeta') - Number(b.kind === 'tarjeta'))
  const cols = pieces.length > 6 ? 4 : 3

  const facts = [
    { title: t({ es: 'Caja de cartón reciclable', en: 'Recyclable cardboard box' }), text: t({ es: 'Con el nombre del kit y tu nivel en el frontal..', en: 'With the kit name and your level on the front.' }) },
    { title: t({ es: 'Todo medido', en: 'Everything measured' }), text: t({ es: 'Cada ingrediente en su sobre o bote, con la cantidad justa para la receta.', en: 'Each ingredient in its own sachet or jar, in the exact amount.' }) },
    fresh
      ? { title: t({ es: 'Caja isotérmica', en: 'Insulated box' }), text: t({ es: 'Los frescos viajan con acumuladores de frío y llegan en 24 h laborables.', en: 'Fresh items travel with ice packs and arrive within 24 working hours.' }) }
      : { title: t({ es: '100 % de despensa', en: '100% cupboard' }), text: t({ es: 'Nada necesita nevera: aguanta 6 meses en un sitio fresco y seco.', en: 'Nothing needs the fridge: keeps for 6 months somewhere cool and dry.' }) },
    { title: t({ es: 'Tarjeta con QR', en: 'QR card' }), text: t({ es: 'Escanéala y tienes la receta paso a paso en el móvil.', en: 'Scan it for the step-by-step recipe on your phone.' }) },
  ]

  return (
    <section aria-labelledby="empaquetado" className="mt-20 overflow-hidden rounded-[36px] bg-mist">
      <div className="grid items-center gap-10 p-6 sm:p-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:p-14">
        {/* Escenario de la caja */}
        <div className="relative mx-auto aspect-square w-full max-w-[520px] [perspective:1200px]">
          <div aria-hidden className="absolute inset-x-[12%] bottom-[6%] h-6 rounded-[50%] bg-black/10 blur-xl" />

          <AnimatePresence>
            {!open && (
              <motion.div
                key="caja"
                className="absolute inset-x-[10%] top-[16%] bottom-[10%]"
                initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                animate={reduced ? undefined : { opacity: 1, scale: 1, y: [0, -8, 0] }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 40, transition: { duration: 0.35 } }}
                transition={{ y: { duration: 4, repeat: Infinity, ease: 'easeInOut' }, default: spring }}
              >
                {/* Tapa */}
                <div className="absolute inset-x-[-4%] top-0 z-10 h-[22%] rounded-t-[22px] rounded-b-md bg-gradient-to-b from-[#c43a26] to-teja shadow-[0_10px_20px_-8px_rgb(0_0_0/0.4)]">
                  <span className="absolute inset-x-[44%] top-0 h-full bg-almendra/80" />
                </div>
                {/* Cuerpo */}
                <div className="btn-sheen absolute inset-x-0 top-[18%] bottom-0 flex flex-col items-center justify-center overflow-hidden rounded-b-[26px] bg-gradient-to-br from-chef to-teja px-6 text-center text-white shadow-[0_30px_60px_-25px_rgb(191_45_17/0.7)]">
                  <span className="absolute inset-y-0 left-[44%] w-[12%] bg-almendra/80" aria-hidden />
                  <span className="relative grid size-16 place-items-center rounded-full bg-white shadow-lg sm:size-20">
                    <Image src="/brand/logo-320.png" alt="" width={320} height={290} className="h-11 w-auto sm:h-14" />
                  </span>
                  <span className="relative mt-3 rounded-full bg-white px-4 py-1.5 font-display text-lg leading-tight font-extrabold text-ink sm:text-2xl">{shortName}</span>
                  {level && (
                    <span className="relative mt-2 rounded-full bg-black/25 px-3 py-1 text-[12px] font-semibold tracking-wide uppercase backdrop-blur">
                      {t({ es: `Nivel ${level}`, en: `Level ${level}` })}
                      {levelName ? ` · ${levelName}` : ''}
                    </span>
                  )}
                  {fresh && (
                    <span className="relative mt-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-[#14507A] uppercase">
                      <SnowflakeIcon size={12} /> {t({ es: 'Refrigerado', en: 'Chilled' })}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {open && (
              <motion.ul
                key="piezas"
                className="absolute inset-0 grid content-center gap-2.5 sm:gap-3"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                initial="hidden"
                animate="shown"
                exit="hidden"
                variants={{ shown: { transition: { staggerChildren: reduced ? 0 : 0.07, delayChildren: reduced ? 0 : 0.15 } } }}
              >
                {pieces.map((p, i) => (
                  <motion.li
                    key={p.key}
                    className="aspect-[5/6]"
                    variants={{
                      hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 140, scale: 0.4, rotate: (i % 2 ? 1 : -1) * 18 },
                      shown: { opacity: 1, y: 0, scale: 1, rotate: (i % 3) - 1, transition: spring },
                    }}
                    whileHover={reduced ? undefined : { y: -6, rotate: 0, scale: 1.05 }}
                  >
                    <PieceCard piece={p} qrSvg={qrSvg} />
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {/* Explicación */}
        <div>
          <p className="eyebrow">{t({ es: 'Empaquetado', en: 'Packaging' })}</p>
          <h2 id="empaquetado" className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t({ es: 'Así te llega.', en: 'How it arrives.' })}{' '}
            <span className="text-chef">{t({ es: `${pieces.length} piezas en una caja.`, en: `${pieces.length} pieces in one box.` })}</span>
          </h2>
          <ul className="mt-6 space-y-4">
            {facts.map((f, i) => (
              <li key={f.title} className="flex gap-3.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-chef font-display text-[13px] font-bold text-white">{i + 1}</span>
                <span>
                  <span className="block font-semibold">{f.title}</span>
                  <span className="block text-[15px] text-ash-ink">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={cn(
              'mt-8 inline-flex h-12 items-center gap-2 rounded-full px-7 text-[15px] font-semibold transition-colors',
              open ? 'bg-white text-ink ring-1 ring-line-strong hover:bg-mist' : 'btn-sheen bg-chef-ink text-white hover:bg-chef',
            )}
          >
            {open ? t({ es: 'Cerrar la caja', en: 'Close the box' }) : t({ es: 'Abrir la caja', en: 'Open the box' })}
          </button>
        </div>
      </div>
    </section>
  )
}
