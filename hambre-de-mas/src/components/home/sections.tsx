import Image from 'next/image'
import Link from 'next/link'
import { NewsletterForm } from '@/components/layout/newsletter-form'
import { Reveal, RevealLi } from '@/components/motion/reveal'
import { ProductCard } from '@/components/product/product-card'
import { ButtonLink } from '@/components/ui/button'
import { ReviewAuthor } from '@/components/product/review-author'
import { ChevronRightIcon, DumbbellIcon, PlayIcon, ReturnIcon, ShieldIcon, StarIcon, TruckIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { Scroller } from '@/components/ui/scroller'
import { cn } from '@/lib/cn'
import { commerce } from '@/lib/config/commerce'
import { getCatalog } from '@/lib/catalog'
import { getI18n } from '@/lib/i18n/server'
import { LevelsShowcase, type LevelSlide } from './levels-showcase'
import { formatPrice } from '@/lib/money'
import type { Category, ProductSummary, Review } from '@/lib/types'
import { howItWorksSteps } from '@/lib/how-it-works'

/** Titular de sección de dos tonos, al estilo de la Apple Store. */
export function SectionTitle({ strong, soft, id, action }: { strong: string; soft?: string; id?: string; action?: React.ReactNode }) {
  return (
    <div className="container-page mb-6 flex items-end justify-between gap-6">
      <h2 id={id} className="max-w-3xl font-display text-[28px] leading-tight font-bold tracking-tight sm:text-[34px]">
        {strong} {soft && <span className="text-chef">{soft}</span>}
      </h2>
      {action}
    </div>
  )
}

/** Los niveles en escaparate, cada uno con la foto de su kit más vendido. */
export async function LevelsRow({ categories }: { categories: Category[] }) {
  const { locale } = await getI18n()
  const catalog = getCatalog()
  const tops = await Promise.all(categories.map((c) => catalog.listProducts({ category: c.slug, sort: 'popular', limit: 1 })))
  const slides: LevelSlide[] = categories.map((c, i) => {
    const top = tops[i]?.items[0]
    return {
      slug: c.slug,
      level: c.level,
      name: c.name,
      tagline: c.tagline,
      description: c.description,
      kits: tops[i]?.total ?? 0,
      image: top?.image?.url ?? c.imageUrl ?? '/demo/home/hero-ramen.jpg',
      product: top ? { name: top.name, slug: top.slug, price: formatPrice(top.priceCents, locale) } : null,
    }
  })
  return <LevelsShowcase slides={slides} />
}

/** Tarjeta grande para el carrusel de novedades. */
function FeatureCard({ product, tone, labels }: { product: ProductSummary; tone: 'light' | 'dark'; labels: { fresh: string; from: string; price: string } }) {
  return (
    <Link
      href={`/producto/${product.slug}`}
      className={cn(
        'group relative flex h-[460px] w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-tile)] shadow-card transition-[box-shadow,transform] duration-500 ease-[var(--ease-apple)] hover:scale-[1.012] hover:shadow-card-hover sm:h-[500px] sm:w-[400px]',
        tone === 'dark' ? 'bg-ink text-white' : 'bg-white text-ink',
      )}
    >
      <div className="relative z-10 p-7">
        <p className={cn('text-[12px] font-semibold tracking-wide uppercase', tone === 'dark' ? 'text-almendra' : 'text-teja')}>
          {product.badge ?? labels.fresh}
        </p>
        <h3 className="mt-2 font-display text-[26px] leading-tight font-bold">{product.name}</h3>
        <p className={cn('mt-2 line-clamp-2 text-[15px]', tone === 'dark' ? 'text-white/70' : 'text-ash-ink')}>{product.subtitle}</p>
        <p className="mt-3 text-[15px] tabular-nums">
          {labels.from} {labels.price}
        </p>
      </div>
      <div className="relative mt-auto h-[55%]">
        {product.image && (
          <ProductImage
            src={product.image.url}
            alt={product.image.alt || product.name}
            fill
            sizes="400px"
            className="object-cover transition-transform duration-700 ease-[var(--ease-apple)] group-hover:scale-105"
          />
        )}
      </div>
    </Link>
  )
}

export async function NewArrivals({ products }: { products: ProductSummary[] }) {
  if (products.length === 0) return null
  const { locale, t } = await getI18n()
  return (
    <section aria-labelledby="novedades" className="bg-mist pt-16 pb-6">
      <SectionTitle
        id="novedades"
        strong={t({ es: 'Lo último.', en: 'Just in.' })}
        soft={t({ es: 'Recién salido del horno.', en: 'Fresh out of the oven.' })}
        action={
          <Link href="/tienda?nuevos=1" className="hidden shrink-0 items-center gap-1 text-[15px] text-teja hover:underline sm:inline-flex">
            {t({ es: 'Ver novedades', en: 'See new arrivals' })} <ChevronRightIcon size={16} />
          </Link>
        }
      />
      <Scroller label={t({ es: 'Novedades', en: 'New arrivals' })}>
        {products.map((p, i) => (
          <FeatureCard
            key={p.id}
            product={p}
            tone={i % 3 === 1 ? 'dark' : 'light'}
            labels={{ fresh: t({ es: 'Nuevo', en: 'New' }), from: t({ es: 'Desde', en: 'From' }), price: formatPrice(p.priceCents, locale) }}
          />
        ))}
      </Scroller>
    </section>
  )
}

export function ProductGridSection({
  id,
  strong,
  soft,
  products,
  href,
  linkLabel,
  className,
}: {
  id: string
  strong: string
  soft?: string
  products: ProductSummary[]
  href: string
  linkLabel: string
  className?: string
}) {
  if (products.length === 0) return null
  return (
    <section aria-labelledby={id} className={cn('py-16', className)}>
      <SectionTitle
        id={id}
        strong={strong}
        soft={soft}
        action={
          <Link href={href} className="hidden shrink-0 items-center gap-1 text-[15px] text-teja hover:underline sm:inline-flex">
            {linkLabel} <ChevronRightIcon size={16} />
          </Link>
        }
      />
      <div className="container-page grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p, i) => (
          <Reveal key={p.id} delay={(i % 4) * 0.07}>
            <ProductCard product={p} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}

export async function BestSellers({ products }: { products: ProductSummary[] }) {
  if (products.length === 0) return null
  const { locale, t } = await getI18n()
  return (
    <section aria-labelledby="mas-vendidos" className="bg-mist py-16">
      <SectionTitle
        id="mas-vendidos"
        strong={t({ es: 'Los más vendidos.', en: 'Best sellers.' })}
        soft={t({ es: 'Lo que más se cocina este mes.', en: "What everyone's cooking this month." })}
      />
      <div className="container-page">
        <ol className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {products.map((p, i) => (
            <RevealLi key={p.id} delay={i * 0.05} className="min-w-0">
                <Link
                  href={`/producto/${p.slug}`}
                  className="group flex items-center gap-5 rounded-[22px] bg-white p-4 pr-6 shadow-card transition-shadow duration-300 hover:shadow-card-hover"
                >
                  <span className="w-8 shrink-0 text-center font-display text-3xl font-extrabold text-chef">{i + 1}</span>
                  <span className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-mist sm:size-24">
                    {p.image && <ProductImage src={p.image.url} alt="" fill sizes="96px" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold tracking-wide text-teja uppercase">
                      {p.category?.level ? t({ es: `Nivel ${p.category.level}`, en: `Level ${p.category.level}` }) : p.category?.name}
                    </span>
                    <span className="block truncate font-semibold sm:text-[17px]">{p.name}</span>
                    <span className="block text-sm text-ash-ink tabular-nums">
                      {t({ es: 'Desde', en: 'From' })} {formatPrice(p.priceCents, locale)}
                    </span>
                  </span>
                  <ChevronRightIcon className="shrink-0 text-ash transition-transform group-hover:translate-x-1" />
                </Link>
            </RevealLi>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** «Para el gym»: kits altos en proteína (etiqueta alto-en-proteina), con los gramos por ración. */
export async function GymSection({ products: all, total }: { products: ProductSummary[]; total: number }) {
  if (all.length === 0) return null
  const { locale, t } = await getI18n()
  const max = Math.max(...all.map((p) => p.attributes.protein ?? 0))
  const products = all.slice(0, 4)
  return (
    <section aria-labelledby="gym" className="py-16">
      <div className="container-page">
        <div className="overflow-hidden rounded-[36px] bg-ink p-7 text-white sm:p-10 lg:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:gap-16">
            <div>
              <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold ring-1 ring-white/15">
                <DumbbellIcon size={16} /> {t({ es: 'Para el gym', en: 'For the gym' })}
              </p>
              <h2 id="gym" className="mt-5 font-display text-[34px] leading-[1.05] font-extrabold tracking-tight text-balance sm:text-[48px]">
                {t({ es: 'Alto en proteína.', en: 'High in protein.' })}{' '}
                <span className="text-chef">{t({ es: 'Para después de entrenar.', en: 'For after training.' })}</span>
              </h2>
              <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-white/70">
                {t({
                  es: 'Pollo, salmón, ternera, huevo y legumbres. Recetas con 20 g de proteína o más por ración para recuperar después del entreno.',
                  en: 'Chicken, salmon, beef, egg and pulses. Recipes with 20 g of protein or more per serving to recover after a workout.',
                })}
              </p>
            </div>
            <div>
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
                  <dt className="text-xs text-white/60">{t({ es: 'Hasta', en: 'Up to' })}</dt>
                  <dd className="font-display text-2xl font-extrabold">
                    {max} g <span className="text-sm font-semibold text-white/60">{t({ es: '/ración', en: '/serving' })}</span>
                  </dd>
                </div>
                <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
                  <dt className="text-xs text-white/60">{t({ es: 'Kits', en: 'Kits' })}</dt>
                  <dd className="font-display text-2xl font-extrabold">{total}</dd>
                </div>
              </dl>
              <Link
                href="/tienda?dieta=alto-en-proteina"
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-chef-ink px-6 text-[15px] font-semibold text-white transition-colors hover:bg-teja"
              >
                {t({ es: 'Ver kits altos en proteína', en: 'See high-protein kits' })} <ChevronRightIcon size={16} />
              </Link>
            </div>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={`/producto/${p.slug}`} className="group block">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-[22px] bg-white/10">
                    {p.image && (
                      <ProductImage
                        src={p.image.url}
                        alt={p.image.alt}
                        fill
                        sizes="(min-width: 1024px) 200px, 45vw"
                        className="object-cover transition-transform duration-700 ease-[var(--ease-apple)] group-hover:scale-105"
                      />
                    )}
                    <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
                    {p.attributes.protein ? (
                      <span className="absolute top-3 left-3 rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-ink">
                        {p.attributes.protein} g {t({ es: 'proteína', en: 'protein' })}
                      </span>
                    ) : null}
                    <div className="absolute inset-x-3 bottom-3">
                      <p className="text-[15px] leading-snug font-semibold">{p.name}</p>
                      <p className="text-xs text-white/70 tabular-nums">
                        {t({ es: 'Desde', en: 'From' })} {formatPrice(p.priceCents, locale)}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export async function HowItWorks() {
  const { t } = await getI18n()
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="py-20 sm:py-28">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <p className="eyebrow">{t({ es: 'Cómo funciona', en: 'How it works' })}</p>
          <h2 id="como-funciona-titulo" className="mt-3 font-display text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">
            {t({ es: 'Aprender a cocinar como si fuera un videojuego.', en: 'Learn to cook like it’s a video game.' })}
          </h2>
          <p className="mt-5 max-w-lg text-lg text-ash-ink">
            {t({
              es: 'Superas niveles y desbloqueas recetas nuevas. Sin listas de la compra imposibles: lo difícil de encontrar ya va en la caja.',
              en: 'Beat levels and unlock new recipes. No impossible shopping lists: the hard-to-find stuff is already in the box.',
            })}
          </p>
          <ol className="mt-10 space-y-4">
            {howItWorksSteps.map((s, i) => (
              <RevealLi key={s.n} delay={0.1 + i * 0.08} className="flex gap-5 rounded-[22px] bg-almendra-soft p-5">
                  <span className="jiggle-hover grid size-11 shrink-0 place-items-center rounded-full bg-chef-ink font-display text-lg font-extrabold text-white">
                    {s.n}
                  </span>
                  <span>
                    <span className="block font-display text-lg font-bold text-teja">{t(s.title)}</span>
                    <span className="block text-[15px] text-ink/80">{t(s.text)}</span>
                  </span>
              </RevealLi>
            ))}
          </ol>
        </Reveal>
        <Reveal delay={0.1} className="relative">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[36px] bg-mist shadow-float sm:aspect-[5/6]">
            <Image
              src="/demo/home/cocinando.jpg"
              alt={t({ es: 'Una chica salteando verduras en una sartén', en: 'A girl stir-frying vegetables in a pan' })}
              fill
              sizes="(min-width: 1024px) 45vw, 92vw"
              quality={85}
              className="object-cover"
            />
          </div>
          <div className="absolute -bottom-6 -left-2 flex items-center gap-3 rounded-[20px] bg-white p-4 pr-6 shadow-float sm:-left-8">
            <span className="grid size-11 place-items-center rounded-2xl bg-ink text-white">
              <PlayIcon size={22} />
            </span>
            <span>
              <span className="block text-sm font-semibold">{t({ es: 'Escanea el QR', en: 'Scan the QR' })}</span>
              <span className="block text-xs text-ash-ink">{t({ es: 'y cocina con el vídeo paso a paso', en: 'and cook along step by step' })}</span>
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export async function Benefits() {
  const { locale, t } = await getI18n()
  const threshold = formatPrice(commerce.freeShippingThresholdCents, locale).replace(/[,.]00/, '')
  const items = [
    {
      icon: TruckIcon,
      title:
        commerce.freeShippingThresholdCents > 0
          ? t({ es: `Envío gratis desde ${threshold}`, en: `Free shipping from ${threshold}` })
          : t({ es: 'Envío gratis', en: 'Free shipping' }),
      text: t({
        es: `A Península y Baleares en ${commerce.deliveryEstimate}.`,
        en: `To mainland Spain and the Balearic Islands in ${commerce.deliveryEstimate.replace('h laborables', 'working hours')}.`,
      }),
    },
    {
      icon: ShieldIcon,
      title: t({ es: 'Pago seguro', en: 'Secure payment' }),
      text: t({ es: 'En la pasarela de Stripe. Nunca vemos ni guardamos tu tarjeta.', en: 'Through Stripe. We never see or store your card.' }),
    },
    {
      icon: ReturnIcon,
      title: t({ es: 'Devoluciones fáciles', en: 'Easy returns' }),
      text: t({ es: `${commerce.returnDays} días para productos sin abrir.`, en: `${commerce.returnDays} days for unopened products.` }),
    },
    {
      icon: PlayIcon,
      title: t({ es: 'Receta paso a paso', en: 'Step-by-step recipe' }),
      text: t({ es: 'Cada kit trae un QR que abre la receta en el móvil.', en: 'Every kit has a QR code that opens the recipe on your phone.' }),
    },
  ]
  return (
    <section aria-label={t({ es: 'Ventajas de comprar en Hambre de Más', en: 'Why shop at Hambre de Más' })} className="py-20">
      <ul className="container-page grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }, i) => (
          <RevealLi key={title} delay={i * 0.06}>
              <span className="grid size-12 place-items-center rounded-2xl bg-mist text-chef">
                <Icon size={24} />
              </span>
              <p className="mt-4 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-ash-ink">{text}</p>
          </RevealLi>
        ))}
      </ul>
    </section>
  )
}

type HomeReview = Review & { productName: string; productSlug: string }

function ReviewCard({ review, verifiedLabel, starsLabel }: { review: HomeReview; verifiedLabel: string; starsLabel: string }) {
  return (
    <article className="flex h-full w-[320px] shrink-0 flex-col rounded-[24px] bg-white p-6 shadow-card ring-1 ring-black/[0.03] sm:w-[360px]">
      <div className="flex gap-0.5 text-chef" aria-label={starsLabel}>
        {Array.from({ length: 5 }, (_, i) => (
          <StarIcon key={i} size={16} filled={i < review.rating} />
        ))}
      </div>
      {review.title && <p className="mt-3 font-semibold">{review.title}</p>}
      <p className="mt-2 line-clamp-4 text-[15px] leading-relaxed text-ink/80">{review.body}</p>
      <div className="mt-auto pt-5">
        <ReviewAuthor
          name={review.authorName}
          verifiedLabel={review.isVerified ? verifiedLabel : null}
          meta={
            <>
              <span aria-hidden>·</span>
              <Link href={`/producto/${review.productSlug}`} className="truncate text-teja hover:underline">
                {review.productName}
              </Link>
            </>
          }
        />
      </div>
    </article>
  )
}

/**
 * Opiniones verificadas en movimiento: con suficientes, dos filas que se
 * desplazan solas en sentidos contrarios (se paran al pasar el ratón). Con
 * pocas, una fila fija; sin ninguna, una invitación a dejar la primera.
 * Siempre son opiniones reales de compras verificadas.
 */
export async function VerifiedReviews({ reviews }: { reviews: HomeReview[] }) {
  const { t } = await getI18n()
  const verified = t({ es: 'Compra verificada', en: 'Verified purchase' })
  const stars = (r: HomeReview) => t({ es: `${r.rating} de 5 estrellas`, en: `${r.rating} out of 5 stars` })
  const card = (r: HomeReview, hidden = false) => (
    <li key={`${r.id}${hidden ? '-copia' : ''}`} aria-hidden={hidden || undefined} className="flex">
      <ReviewCard review={r} verifiedLabel={verified} starsLabel={stars(r)} />
    </li>
  )
  const rows = reviews.length >= 6 ? [reviews.filter((_, i) => i % 2 === 0), reviews.filter((_, i) => i % 2 === 1)] : [reviews]
  const moving = reviews.length >= 4

  return (
    <section aria-labelledby="opiniones" className="overflow-hidden bg-mist py-20">
      <SectionTitle
        id="opiniones"
        strong={t({ es: 'Opiniones verificadas.', en: 'Verified reviews.' })}
        soft={t({ es: 'Solo de quien ha comprado y cocinado el kit.', en: 'Only from people who bought and cooked the kit.' })}
      />
      {reviews.length === 0 ? (
        <div className="container-page">
          <Reveal className="flex flex-col items-start gap-6 rounded-[32px] bg-white p-8 shadow-card sm:flex-row sm:items-center sm:p-10">
            <div className="review-stars flex gap-1.5 text-chef" aria-hidden>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} style={{ '--i': i } as React.CSSProperties}>
                  <StarIcon size={30} />
                </span>
              ))}
            </div>
            <div className="flex-1">
              <p className="font-display text-2xl font-bold">{t({ es: 'Aquí van las opiniones de verdad.', en: 'Real reviews go here.' })}</p>
              <p className="mt-1.5 max-w-xl text-ash-ink">
                {t({
                  es: 'Cuando cocines tu kit te escribiremos para que nos cuentes qué tal. Solo publicamos opiniones de compras verificadas.',
                  en: "Once you've cooked your kit we'll email you to ask how it went. We only publish reviews from verified purchases.",
                })}
              </p>
            </div>
            <ButtonLink href="/tienda" size="md">
              {t({ es: 'Elegir mi kit', en: 'Pick my kit' })}
            </ButtonLink>
          </Reveal>
        </div>
      ) : moving ? (
        <div className="reviews-marquee space-y-5 [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
          {rows.map((row, r) => (
            <ul key={r} className="reviews-track flex w-max gap-5" data-reverse={r === 1 || undefined} style={{ '--n': row.length } as React.CSSProperties}>
              {row.map((review) => card(review))}
              {row.map((review) => card(review, true))}
            </ul>
          ))}
        </div>
      ) : (
        <ul className="container-page flex gap-5 overflow-x-auto pb-2 [scrollbar-width:none]">
          {reviews.map((review, i) => (
            <RevealLi key={review.id} delay={i * 0.08} className="flex">
              <ReviewCard review={review} verifiedLabel={verified} starsLabel={stars(review)} />
            </RevealLi>
          ))}
        </ul>
      )}
    </section>
  )
}

export async function NewsletterSection() {
  const { t } = await getI18n()
  return (
    <section aria-labelledby="newsletter" className="px-3 pb-16 sm:px-6">
      <div className="mx-auto flex max-w-[88rem] flex-col items-center rounded-[40px] bg-mist px-6 py-16 text-center sm:py-20">
        <p className="eyebrow">Newsletter</p>
        <h2 id="newsletter" className="mt-3 max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t({ es: 'Recetas nuevas antes que nadie.', en: 'New recipes before anyone else.' })}
        </h2>
        <p className="mt-3 max-w-lg text-ash-ink">
          {t({
            es: 'Un email al mes con los kits que llegan, retos de cocina y algún código de descuento.',
            en: 'One email a month with upcoming kits, cooking challenges and the odd discount code.',
          })}
        </p>
        <div className="mt-8 flex w-full justify-center text-left">
          <NewsletterForm />
        </div>
      </div>
    </section>
  )
}

