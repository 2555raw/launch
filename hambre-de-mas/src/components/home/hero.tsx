import Link from 'next/link'
import { buttonClass } from '@/components/ui/button'
import { ArrowRightIcon, ChevronRightIcon, PlayIcon, ShieldIcon, TruckIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { formatPrice } from '@/lib/money'
import type { ProductSummary } from '@/lib/types'

/**
 * Portada sobre fondo blanco: titular, llamadas a la acción y el kit destacado
 * en una sola foto grande, con la tarjeta de receta (QR real) y la ficha de
 * compra encima. Las entradas son CSS (globals.css), así que funcionan aunque
 * el JavaScript no haya cargado.
 */

type Props = {
  product: ProductSummary | null
  includes?: string[]
  /** SVG del QR que abre la receta del kit. */
  qrSvg?: string | null
  recipeHref?: string
}

const v = (vars: Record<string, string | number>) => vars as React.CSSProperties

export function Hero({ product, includes, qrSvg, recipeHref }: Props) {
  return (
    <section className="relative overflow-hidden bg-white">
      <div className="container-page grid items-center gap-12 pt-10 pb-16 sm:pt-14 lg:min-h-[min(760px,calc(100dvh-3.5rem))] lg:grid-cols-[1fr_1fr] lg:gap-16 lg:py-16">
        <div className="max-w-xl">
          <Link
            href="/#niveles"
            className="rise-in group inline-flex items-center gap-2 rounded-full bg-almendra-soft py-1.5 pr-3 pl-1.5 text-[13px] font-medium text-teja transition-colors hover:bg-almendra"
          >
            <span className="rounded-full bg-chef-ink px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white uppercase">3 niveles</span>
            De sin fuego a recetas del mundo
            <ChevronRightIcon size={14} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <h1
            className="rise-in mt-6 font-display text-[44px] leading-[1.03] font-extrabold tracking-[-0.035em] text-balance text-ink sm:text-6xl lg:text-[76px]"
            style={v({ '--delay': '0.08s' })}
          >
            Cocina lo que te <span className="text-chef">flipa.</span>
          </h1>
          <p className="rise-in mt-6 max-w-md text-lg leading-relaxed text-ash-ink sm:text-xl" style={v({ '--delay': '0.16s' })}>
            Kits de cocina para adolescentes. Todo medido en la caja, la receta paso a paso en un QR y tres niveles para ir subiendo.
          </p>
          <div className="rise-in mt-9 flex flex-wrap items-center gap-3" style={v({ '--delay': '0.24s' })}>
            <Link href="/tienda" className={buttonClass('primary', 'lg')}>
              Elegir mi kit
            </Link>
            <Link href="/#como-funciona" className={buttonClass('secondary', 'lg', 'group')}>
              Cómo funciona
              <ArrowRightIcon size={17} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </div>
          <ul className="rise-in mt-12 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6" style={v({ '--delay': '0.32s' })}>
            <HeroFact icon={<TruckIcon size={18} />} title="Envío gratis" text="desde 40 €" />
            <HeroFact icon={<PlayIcon size={18} />} title="Receta en QR" text="en cada kit" />
            <HeroFact icon={<ShieldIcon size={18} />} title="Pago seguro" text="con Stripe" />
          </ul>
        </div>

        <FeaturedKit product={product} includes={includes} qrSvg={qrSvg} recipeHref={recipeHref} />
      </div>
    </section>
  )
}

function HeroFact({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex flex-col gap-1.5 text-[13px] leading-snug sm:flex-row sm:items-start sm:gap-2.5">
      <span className="mt-0.5 text-chef-ink">{icon}</span>
      <span>
        <strong className="block font-semibold text-ink">{title}</strong>
        <span className="text-ash-ink">{text}</span>
      </span>
    </li>
  )
}

function FeaturedKit({ product, includes, qrSvg, recipeHref }: Props) {
  const image = product?.image?.url ?? '/demo/home/hero-ramen.jpg'
  const level = product?.category?.level
  const contents = (includes ?? []).slice(0, 3)

  return (
    <div className="rise-in relative mx-auto w-full max-w-[560px] lg:mr-0" style={v({ '--delay': '0.2s' })}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[36px] bg-mist">
        <ProductImage
          src={image}
          alt={product?.image?.alt ?? 'Plato terminado del kit destacado'}
          fill
          priority
          sizes="(min-width: 1024px) 560px, 100vw"
          className="object-cover"
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
        {level && (
          <p className="absolute top-5 left-5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink backdrop-blur">
            Nivel {level}
            {product?.category?.name ? ` · ${product.category.name.replace(/^Nivel \d+\s*[·:-]?\s*/i, '')}` : ''}
          </p>
        )}

        {product && (
          <div className="absolute inset-x-4 bottom-4 rounded-[24px] bg-white/95 p-5 shadow-float backdrop-blur sm:inset-x-5 sm:bottom-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-teja uppercase">{product.badge ?? 'Kit destacado'}</p>
                <p className="mt-0.5 font-display text-lg leading-tight font-bold text-ink sm:text-xl">{product.name}</p>
              </div>
              <p className="shrink-0 text-[15px] text-ink tabular-nums">
                <span className="text-ash-ink">Desde </span>
                <strong className="font-semibold">{formatPrice(product.priceCents)}</strong>
              </p>
            </div>
            {contents.length > 0 && (
              <p className="mt-2 line-clamp-1 text-[13px] text-ash-ink">
                En la caja: {contents.join(' · ')}
              </p>
            )}
            <Link href={`/producto/${product.slug}`} className={buttonClass('primary', 'md', 'mt-4 w-full')}>
              Ver el kit
            </Link>
          </div>
        )}
      </div>

      {qrSvg && recipeHref && (
        <div className="absolute top-4 right-4 w-[clamp(104px,26%,144px)] sm:top-8 sm:-right-6">
          <div className="float-soft rounded-2xl bg-white p-3 shadow-float ring-1 ring-line">
            <a
              href={recipeHref}
              aria-label="Ver la receta del kit destacado"
              className="block [&_svg]:h-auto [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="mt-2 text-center text-[11px] leading-tight font-semibold text-ink">
              Escanea
              <span className="block font-normal text-ash-ink">y cocina paso a paso</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
