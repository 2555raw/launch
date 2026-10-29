import Link from 'next/link'
import { buttonClass } from '@/components/ui/button'
import { ArrowRightIcon, ChevronRightIcon, PlayIcon, ShieldIcon, StarIcon, TruckIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { cn } from '@/lib/cn'
import { HeroStage } from './hero-stage'
import { getI18n } from '@/lib/i18n/server'
import { formatPrice } from '@/lib/money'
import type { ProductSummary } from '@/lib/types'

/**
 * Portada: titular centrado y, debajo, un kit por nivel en abanico (el del
 * centro, más grande, con la tarjeta del QR de su receta). Las entradas y el
 * vaivén son CSS (globals.css), así que funcionan sin JavaScript.
 */

type Props = {
  /** Un kit por nivel (1, 2 y 3), en ese orden. */
  picks: ProductSummary[]
  /** SVG del QR de la receta del kit del centro. */
  qrSvg?: string | null
  recipeHref?: string
  rating?: { average: number; count: number } | null
}

const v = (vars: Record<string, string | number>) => vars as React.CSSProperties

export async function Hero({ picks, qrSvg, recipeHref, rating }: Props) {
  const { locale, t } = await getI18n()
  const [left, center, right] = picks.length >= 3 ? [picks[0], picks[1], picks[2]] : [undefined, picks[0], undefined]

  return (
    <section className="relative overflow-hidden bg-white">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(253_228_207/0.7),transparent)]" />
      <div className="container-page relative flex flex-col items-center pt-12 pb-10 text-center sm:pt-16">
        <Link
          href="/#niveles"
          className="rise-in group inline-flex items-center gap-2 rounded-full bg-white py-1.5 pr-3 pl-1.5 text-[13px] font-medium text-teja shadow-[0_1px_0_rgb(0_0_0/0.04),0_6px_20px_-10px_rgb(191_45_17/0.35)] ring-1 ring-almendra transition-colors hover:bg-almendra-soft"
        >
          <span className="rounded-full bg-chef-ink px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white uppercase">{t({ es: '3 niveles', en: '3 levels' })}</span>
          {t({ es: 'De sin fuego a recetas del mundo', en: 'From no-heat to world recipes' })}
          <ChevronRightIcon size={14} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
        <h1 className="mt-7 max-w-4xl font-display text-[46px] leading-[1.02] font-extrabold tracking-[-0.04em] text-balance text-ink sm:text-7xl lg:text-[96px]">
          {t({ es: 'Cocina lo que te', en: 'Cook what you' })
            .split(' ')
            .map((word, i) => (
              <span key={i} className="hero-word" style={v({ '--delay': `${0.1 + i * 0.09}s` })}>
                {word}&nbsp;
              </span>
            ))}
          <span className="hero-word relative text-chef" style={v({ '--delay': '0.55s' })}>
            {t({ es: 'flipa.', en: 'crave.' })}
            <svg aria-hidden viewBox="0 0 200 20" preserveAspectRatio="none" className="hero-underline absolute -bottom-[0.12em] left-[2%] h-[0.22em] w-[92%]">
              <path d="M3 14 C 50 4, 120 4, 197 12" pathLength={1} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className="rise-in mt-6 max-w-2xl text-lg leading-relaxed text-ash-ink sm:text-xl" style={v({ '--delay': '0.75s' })}>
          {t({
            es: 'Kits de cocina para adolescentes. Todo medido en la caja, la receta paso a paso en un QR y tres niveles para ir subiendo.',
            en: 'Cooking kits for teens. Everything pre-measured in the box, a step-by-step recipe on a QR code and three levels to climb.',
          })}
        </p>
        <div className="rise-in mt-9 flex flex-wrap items-center justify-center gap-3" style={v({ '--delay': '0.85s' })}>
          <Link href="/tienda" className={buttonClass('primary', 'lg')}>
            {t({ es: 'Elegir mi kit', en: 'Pick my kit' })}
          </Link>
          <Link href="/#como-funciona" className={buttonClass('secondary', 'lg', 'group')}>
            {t({ es: 'Cómo funciona', en: 'How it works' })}
            <ArrowRightIcon size={17} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>
        {rating && rating.count > 0 && (
          <p className="rise-in mt-6 flex items-center gap-2 text-sm text-ash-ink" style={v({ '--delay': '0.95s' })}>
            <span className="flex gap-0.5 text-chef">
              {Array.from({ length: 5 }, (_, i) => (
                <StarIcon key={i} size={15} />
              ))}
            </span>
            <strong className="font-semibold text-ink">{rating.average.toFixed(1).replace('.', locale === 'en' ? '.' : ',')}</strong>
            {t({ es: `de ${rating.count} opiniones`, en: `from ${rating.count} reviews` })}
          </p>
        )}

        {/* Un kit por nivel, en abanico */}
        <HeroStage className="relative mt-12 h-[290px] w-full max-w-5xl sm:mt-14 sm:h-[520px] lg:h-[560px]">
          {left && <KitCard product={left} locale={locale} side="left" className="left-0 w-[46%] -rotate-6 sm:left-[2%] sm:w-[34%]" enter="hero-fan-left" delay="0s" />}
          {right && <KitCard product={right} locale={locale} side="right" className="right-0 w-[46%] rotate-6 sm:right-[2%] sm:w-[34%]" enter="hero-fan-right" delay="1.5s" />}
          {center && (
            <KitCard product={center} locale={locale} className="left-1/2 z-10 w-[58%] -translate-x-1/2 sm:w-[40%]" enter="hero-rise" delay="0.75s" big>
              {qrSvg && recipeHref && (
                <a
                  href={recipeHref}
                  aria-label={t({ es: 'Ver la receta del kit', en: 'See the kit recipe' })}
                  className="hero-drop absolute -top-5 -right-6 hidden w-28 -rotate-3 rounded-2xl bg-white p-2.5 shadow-float ring-1 ring-line transition-transform hover:rotate-0 sm:block lg:-right-10 lg:w-32"
                >
                  <span className="block [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                  <span className="mt-1 block text-center text-[10px] leading-tight font-semibold text-ink">
                    {t({ es: 'Escanea y cocina', en: 'Scan and cook' })}
                  </span>
                </a>
              )}
            </KitCard>
          )}
        </HeroStage>
      </div>

      <div className="container-page pb-14">
        <ul className="mx-auto grid max-w-3xl grid-cols-3 gap-4 border-t border-line pt-7">
          <HeroFact icon={<TruckIcon size={18} />} title={t({ es: 'Envío gratis', en: 'Free shipping' })} text={t({ es: 'desde 40 €', en: 'from €40' })} />
          <HeroFact icon={<PlayIcon size={18} />} title={t({ es: 'Receta en QR', en: 'QR recipe' })} text={t({ es: 'en cada kit', en: 'in every kit' })} />
          <HeroFact icon={<ShieldIcon size={18} />} title={t({ es: 'Pago seguro', en: 'Secure payment' })} text={t({ es: 'con Stripe', en: 'with Stripe' })} />
        </ul>
      </div>
    </section>
  )
}

function KitCard({
  product,
  locale,
  className,
  delay,
  big = false,
  side,
  enter,
  children,
}: {
  product: ProductSummary
  locale: 'es' | 'en'
  className?: string
  delay: string
  big?: boolean
  /** Tarjetas laterales: la etiqueta va arriba, en la esquina que no tapa la del centro. */
  side?: 'left' | 'right'
  /** Animación de entrada (globals.css). */
  enter?: string
  children?: React.ReactNode
}) {
  const level = product.category?.level
  return (
    <div className={cn('absolute top-0 sm:top-6', big && 'top-0 sm:top-0', enter, className)}>
      <div className="hero-depth" style={v({ '--d': big ? '6px' : '14px' })}>
      <div className="float-soft relative" style={v({ animationDelay: delay })}>
        <Link
          href={`/producto/${product.slug}`}
          className={cn(
            'group relative block aspect-[4/5] overflow-hidden rounded-[28px] bg-mist shadow-[0_40px_80px_-30px_rgb(29_29_31/0.45)] ring-1 ring-black/5 transition-transform duration-500 ease-[var(--ease-apple)] hover:-translate-y-2 sm:rounded-[36px]',
          )}
        >
          <ProductImage
            src={product.image?.url ?? '/demo/products/wraps-1.jpg'}
            alt={product.image?.alt ?? product.name}
            fill
            priority={big}
            sizes="(min-width: 1024px) 420px, 50vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
          {side ? (
            <span
              className={cn(
                'absolute top-3 hidden max-w-[58%] rounded-2xl bg-white/90 px-3 py-2 text-left backdrop-blur sm:top-4 sm:block',
                side === 'left' ? 'left-3 sm:left-4' : 'right-3 sm:right-4',
              )}
            >
              {level && <span className="block text-[10px] font-bold tracking-wider text-teja uppercase">{locale === 'en' ? 'Level' : 'Nivel'} {level}</span>}
              <span className="block truncate font-display text-[13px] font-bold text-ink sm:text-[15px]">{product.name}</span>
              <span className="block text-[12px] font-semibold text-ink/70 tabular-nums">{formatPrice(product.priceCents, locale)}</span>
            </span>
          ) : (
          <>
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 rounded-2xl bg-white/90 px-3.5 py-2.5 text-left backdrop-blur sm:inset-x-4 sm:bottom-4">
            <span className="min-w-0">
              {level && (
                <span className="block text-[10px] font-bold tracking-wider text-teja uppercase sm:text-[11px]">
                  {locale === 'en' ? 'Level' : 'Nivel'} {level}
                </span>
              )}
              <span className={cn('block truncate font-display font-bold text-ink', big ? 'text-[15px] sm:text-lg' : 'text-[13px] sm:text-base')}>{product.name}</span>
            </span>
            <span className="shrink-0 text-[13px] font-semibold text-ink tabular-nums sm:text-sm">{formatPrice(product.priceCents, locale)}</span>
          </div>
          </>
          )}
        </Link>
        {children}
      </div>
      </div>
    </div>
  )
}

function HeroFact({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex flex-col items-center gap-1.5 text-center text-[13px] leading-snug sm:flex-row sm:justify-center sm:gap-2.5 sm:text-left">
      <span className="text-chef-ink">{icon}</span>
      <span>
        <strong className="block font-semibold text-ink">{title}</strong>
        <span className="text-ash-ink">{text}</span>
      </span>
    </li>
  )
}
