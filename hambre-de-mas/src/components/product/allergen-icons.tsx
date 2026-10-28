'use client'

import { cn } from '@/lib/cn'
import { ALLERGEN_CODES, allergenInfo, allergenLabel, type Allergen } from '@/lib/allergens'
import { useI18n } from '@/lib/i18n/client'

/**
 * Pictogramas de alérgenos: círculo de color con un dibujo blanco.
 * Dibujados para la tienda (no copian ningún set de iconos comercial).
 */

const W = { fill: 'none', stroke: '#fff', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const F = { fill: '#fff' } as const

const glyphs: Record<Allergen, React.ReactNode> = {
  gluten: (
    <>
      <path d="M24 38V14" {...W} />
      {[17, 23, 29].map((y) => (
        <g key={y}>
          <ellipse cx="20" cy={y} rx="2.6" ry="4.4" transform={`rotate(-30 20 ${y})`} {...F} />
          <ellipse cx="28" cy={y} rx="2.6" ry="4.4" transform={`rotate(30 28 ${y})`} {...F} />
        </g>
      ))}
      <ellipse cx="24" cy="11.5" rx="2.4" ry="3.8" {...F} />
    </>
  ),
  crustaceos: (
    <>
      <path d="M32 15c-8-3-17 2-17 11 0 6 4 10 9 10 3 0 5-2 5-4" {...W} />
      <path d="M18 21l5 3M17 27l6 1M20 32l4-2" {...W} />
      <path d="M29 32l5 3-1-6" {...W} />
      <path d="M32 15l4-3M32 15l5 1" {...W} />
      <circle cx="29" cy="18" r="1.4" {...F} />
    </>
  ),
  moluscos: (
    <>
      <path d="M12 26c0-8 5-13 12-13s12 5 12 13l-5 6H17z" {...W} />
      <path d="M24 13v19M18 15l2 17M30 15l-2 17M14 20l4.5 12M34 20l-4.5 12" {...W} />
      <path d="M20 32h8l-1 4h-6z" {...F} />
    </>
  ),
  pescado: (
    <>
      <path d="M11 24c4-6 9-8 14-8s9 4 11 8c-2 4-6 8-11 8s-10-2-14-8z" {...F} />
      <path d="M35 24l5-5v10z" {...F} />
      <circle cx="17" cy="22.5" r="1.6" fill="currentColor" />
    </>
  ),
  huevos: <path d="M24 12c-6 0-10 9-10 15 0 6 4.5 10 10 10s10-4 10-10c0-6-4-15-10-15z" {...F} />,
  altramuces: (
    <>
      <circle cx="18" cy="20" r="6" {...F} />
      <circle cx="30" cy="20" r="6" {...F} />
      <circle cx="24" cy="31" r="6" {...F} />
    </>
  ),
  mostaza: (
    <>
      <rect x="17" y="11" width="14" height="5" rx="1.5" {...F} />
      <path d="M16 19h16v15a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3z" {...W} />
      <path d="M20 26h8" {...W} />
    </>
  ),
  cacahuetes: (
    <>
      <path d="M24 11c4 0 6 3 6 6.5 0 2.5-1.5 4-1.5 6.5s1.5 4 1.5 6.5c0 3.5-2 6.5-6 6.5s-6-3-6-6.5c0-2.5 1.5-4 1.5-6.5S18 20 18 17.5c0-3.5 2-6.5 6-6.5z" {...W} />
      <path d="M21 17h6M21 30h6" {...W} />
    </>
  ),
  'frutos-de-cascara': (
    <>
      <path d="M14 21c0-5 4.5-8 10-8s10 3 10 8z" {...F} />
      <path d="M24 13v-3" {...W} />
      <path d="M16 23h16c0 7-4 13-8 14-4-1-8-7-8-14z" {...W} />
    </>
  ),
  soja: (
    <>
      <path d="M15 33c-3-9 4-21 15-22 3 9-4 21-15 22z" {...W} />
      <circle cx="19.5" cy="27" r="2.6" {...F} />
      <circle cx="23.5" cy="21.5" r="2.6" {...F} />
      <circle cx="27" cy="16" r="2.4" {...F} />
    </>
  ),
  sesamo: (
    <>
      {[
        [19, 17],
        [29, 17],
        [24, 25],
        [17, 31],
        [31, 31],
      ].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y! - 4.5}c2.2 2.6 3 4.2 3 5.6a3 3 0 0 1-6 0c0-1.4.8-3 3-5.6z`} {...F} />
      ))}
    </>
  ),
  apio: (
    <>
      <path d="M19 37V20M24 37V17M29 37V20" {...W} strokeWidth={3.4} />
      <path d="M19 20c-3-1-5-4-4-7 2 1 4 3 4 7zM29 20c3-1 5-4 4-7-2 1-4 3-4 7zM24 17c-2-2-2-5 0-7 2 2 2 5 0 7z" {...F} />
    </>
  ),
  leche: (
    <>
      <path d="M21 10h6v5l3 4v16a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V19l3-4z" {...W} />
      <path d="M18.5 25h11v6h-11z" {...F} />
    </>
  ),
  sulfitos: (
    <text x="24" y="28.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">
      SO₂
    </text>
  ),
}

export function AllergenIcon({
  code,
  size = 40,
  className,
  muted = false,
  title,
  decorative = false,
}: {
  code: Allergen
  size?: number
  className?: string
  /** En gris: el kit no lo contiene. */
  muted?: boolean
  /** Texto del tooltip (por defecto, el nombre del alérgeno). */
  title?: string
  /** Sin nombre accesible propio (cuando el contenedor ya lo describe). */
  decorative?: boolean
}) {
  const { locale } = useI18n()
  const info = allergenInfo(code)
  const label = allergenLabel(code, locale)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      className={cn('shrink-0', className)}
      style={{ color: info.color }}
    >
      <title>{title ?? label}</title>
      <circle cx="24" cy="24" r="24" fill={muted ? '#C7C7CC' : info.color} />
      {glyphs[code]}
    </svg>
  )
}

/** Fila de iconos con su nombre debajo (ficha de producto). */
export function AllergenList({ codes, size = 44 }: { codes: Allergen[]; size?: number }) {
  const { locale } = useI18n()
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-3">
      {codes.map((code) => (
        <li key={code} className="flex w-16 flex-col items-center gap-1.5 text-center text-[11px] leading-tight font-medium text-ink/80">
          <AllergenIcon code={code} size={size} />
          {allergenLabel(code, locale)}
        </li>
      ))}
    </ul>
  )
}

/**
 * Los 14 alérgenos de un vistazo: en color los que contiene el kit, a medio
 * color los que puede contener en trazas y en gris el resto.
 */
export function AllergenStrip({
  codes,
  traces = [],
  size = 20,
  layout = 'grid',
  className,
}: {
  codes: Allergen[]
  traces?: Allergen[]
  size?: number
  /** grid: dos filas de 7 (tarjetas) · row: una fila que salta de línea (ficha). */
  layout?: 'grid' | 'row'
  className?: string
}) {
  const { locale, t } = useI18n()
  const names = (list: Allergen[]) => list.map((c) => allergenLabel(c, locale)).join(', ')
  const label = [
    codes.length
      ? `${t({ es: 'Contiene', en: 'Contains' })}: ${names(codes)}`
      : t({ es: 'Sin alérgenos de declaración obligatoria', en: 'No major allergens' }),
    traces.length ? `${t({ es: 'Puede contener trazas de', en: 'May contain traces of' })}: ${names(traces)}` : '',
  ]
    .filter(Boolean)
    .join('. ')
  return (
    <p
      role="img"
      aria-label={label}
      className={cn(layout === 'grid' ? 'inline-grid grid-cols-7 gap-1' : 'flex flex-wrap items-center gap-1', className)}
    >
      {ALLERGEN_CODES.map((code) => {
        const contains = codes.includes(code)
        const trace = !contains && traces.includes(code)
        const name = allergenLabel(code, locale)
        return (
          <AllergenIcon
            key={code}
            code={code}
            size={size}
            decorative
            muted={!contains && !trace}
            className={cn(trace && 'opacity-50')}
            title={
              contains
                ? `${t({ es: 'Contiene', en: 'Contains' })} ${name.toLowerCase()}`
                : trace
                  ? `${t({ es: 'Trazas de', en: 'Traces of' })} ${name.toLowerCase()}`
                  : `${t({ es: 'Sin', en: 'No' })} ${name.toLowerCase()}`
            }
          />
        )
      })}
    </p>
  )
}
