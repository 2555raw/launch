import Image from 'next/image'
import Link from 'next/link'
import { NewsletterForm } from '@/components/layout/newsletter-form'
import { Reveal, RevealLi } from '@/components/motion/reveal'
import { ProductCard } from '@/components/product/product-card'
import { ReviewAuthor } from '@/components/product/review-author'
import { ButtonLink } from '@/components/ui/button'
import { LevelBars } from '@/components/home/levels-showcase'
import { PurchaseGlobe } from '@/components/home/purchase-globe'
import { ArrowRightIcon, ChevronRightIcon, GiftIcon, PlayIcon, ReturnIcon, ShieldIcon, StarIcon, TruckIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { Scroller } from '@/components/ui/scroller'
import { cn } from '@/lib/cn'
import { commerce } from '@/lib/config/commerce'
import { getCatalog } from '@/lib/catalog'
import { getI18n } from '@/lib/i18n/server'
import { LevelsShowcase, type LevelSlide } from './levels-showcase'
import { formatPrice } from '@/lib/money'
import { PURCHASE_MAP_DAYS, type PurchasePoint } from '@/lib/orders/activity'
import type { Category, ProductSummary, Review } from '@/lib/types'

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
      image: top?.image?.url ?? c.imageUrl ?? '/demo/home/hero-ramen.jpg',
      product: top ? { name: top.name, slug: top.slug, price: formatPrice(top.priceCents, locale) } : null,
    }
  })
  return <LevelsShowcase slides={slides} />
}

/** Accesos rápidos bajo la portada: píldoras transparentes que se rellenan de rojo al pasar el ratón. */
export async function QuickLinks({ categories }: { categories: Category[] }) {
  const { t } = await getI18n()
  const links: { href: string; label: string; icon?: React.ReactNode }[] = [
    ...categories.map((c) => ({
      href: `/categoria/${c.slug}`,
      label: c.level ? t({ es: `Nivel ${c.level}`, en: `Level ${c.level}` }) : c.name,
      icon: c.level ? <LevelBars level={c.level} /> : <GiftIcon size={17} />,
    })),
    { href: '/tienda?orden=novedades', label: t({ es: 'Novedades', en: 'New in' }) },
    { href: '/tienda?tiempo=15', label: t({ es: 'Hasta 15 min', en: 'Up to 15 min' }) },
    { href: '/tienda?dieta=vegetariano', label: t({ es: 'Vegetariano', en: 'Vegetarian' }) },
    { href: '/tienda?dieta=sin-gluten', label: t({ es: 'Sin gluten', en: 'Gluten-free' }) },
  ]
  return (
    <nav aria-label={t({ es: 'Accesos rápidos', en: 'Quick links' })}>
      <ul className="container-page flex gap-2.5 overflow-x-auto py-6 [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:gap-3 [&::-webkit-scrollbar]:hidden">
        {links.map((l) => (
          <li key={l.href} className="shrink-0">
            <Link
              href={l.href}
              className="flex h-11 items-center gap-2.5 rounded-full px-5 text-[15px] font-medium whitespace-nowrap text-ink/75 ring-1 ring-line transition-[background-color,color,box-shadow] duration-200 hover:bg-chef hover:text-white hover:ring-chef focus-visible:bg-chef focus-visible:text-white"
            >
              {l.icon}
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
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
          <Link href="/tienda?orden=novedades" className="hidden shrink-0 items-center gap-1 text-[15px] text-teja hover:underline sm:inline-flex">
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

const steps = [
  {
    n: 1,
    title: { es: 'Eliges tu kit', en: 'Pick your kit' },
    text: { es: 'En la tienda, según tu nivel y lo que te apetezca.', en: "In the shop, by your level and whatever you're craving." },
  },
  {
    n: 2,
    title: { es: 'Te llega a casa', en: 'It arrives at home' },
    text: {
      es: 'Niveles 1 y 2: todo seco, directo a la despensa. Nivel 3: con frescos y en caja refrigerada.',
      en: 'Levels 1 and 2: all dry, straight into the cupboard. Level 3: with fresh food in a chilled box.',
    },
  },
  {
    n: 3,
    title: { es: 'Escaneas y cocinas', en: 'Scan and cook' },
    text: {
      es: 'El QR de la tarjeta abre la receta paso a paso. Completas el nivel y desbloqueas el siguiente.',
      en: 'The QR on the card opens the step-by-step recipe. Finish the level and unlock the next one.',
    },
  },
]

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
            {steps.map((s, i) => (
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

export async function VerifiedReviews({ reviews }: { reviews: (Review & { productName: string; productSlug: string })[] }) {
  if (reviews.length === 0) return null
  const { t } = await getI18n()
  return (
    <section aria-labelledby="opiniones" className="bg-mist py-16">
      <SectionTitle
        id="opiniones"
        strong={t({ es: 'Opiniones verificadas.', en: 'Verified reviews.' })}
        soft={t({ es: 'Solo de quien ha comprado y cocinado el kit.', en: 'Only from people who bought and cooked the kit.' })}
      />
      <ul className="container-page grid gap-5 md:grid-cols-3">
        {reviews.map((r) => (
          <li key={r.id} className="flex flex-col rounded-[22px] bg-white p-6 shadow-card">
            <div className="flex gap-0.5 text-chef" aria-label={t({ es: `${r.rating} de 5 estrellas`, en: `${r.rating} out of 5 stars` })}>
              {Array.from({ length: 5 }, (_, i) => (
                <StarIcon key={i} size={16} filled={i < r.rating} />
              ))}
            </div>
            {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
            <p className="mt-2 line-clamp-5 text-[15px] text-ink/80">{r.body}</p>
            <div className="mt-auto pt-5">
              <ReviewAuthor
                name={r.authorName}
                verifiedLabel={r.isVerified ? t({ es: 'Compra verificada', en: 'Verified purchase' }) : null}
                meta={
                  <>
                    <span aria-hidden>·</span>
                    <Link href={`/producto/${r.productSlug}`} className="truncate text-teja hover:underline">
                      {r.productName}
                    </Link>
                  </>
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Globo con las provincias desde las que se han pedido kits de verdad. */
export async function PurchaseMapSection({ points }: { points: PurchasePoint[] }) {
  const { t } = await getI18n()
  const hasOrders = points.length > 0
  return (
    <section aria-labelledby="mapa-pedidos" className="container-page py-20 sm:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <Reveal>
          <p className="eyebrow">{t({ es: 'Pedidos', en: 'Orders' })}</p>
          <h2 id="mapa-pedidos" className="mt-3 font-display text-[34px] leading-[1.08] font-extrabold tracking-tight text-balance sm:text-5xl">
            {points.length >= 10
              ? t({ es: 'Se cocina por toda España.', en: 'Cooking all over Spain.' })
              : hasOrders
                ? t({ es: 'Así viajan nuestros kits.', en: 'Where our kits travel.' })
              : t({ es: 'Llegamos a toda la Península y Baleares.', en: 'We deliver across mainland Spain and the Balearics.' })}{' '}
            <span className="text-chef">{t({ es: 'Gira la bola.', en: 'Spin the globe.' })}</span>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ash-ink">
            {hasOrders
              ? t({
                  es: `Cada punto es una provincia desde la que se han pedido kits en los últimos ${PURCHASE_MAP_DAYS} días. Cuantos más pedidos, más grande.`,
                  en: `Each dot is a province that has ordered kits in the last ${PURCHASE_MAP_DAYS} days. The more orders, the bigger the dot.`,
                })
              : t({
                  es: `Te lo llevamos a casa en ${commerce.deliveryEstimate}, con los kits de nivel 3 refrigerados. Aquí verás desde dónde se piden.`,
                  en: 'We deliver in 24–72 working hours, with level 3 kits chilled. This is where you will see where orders come from.',
                })}
          </p>
          {hasOrders && (
            <>
              <p className="mt-8 font-display text-5xl font-extrabold tabular-nums">
                {points.length}{' '}
                <span className="text-lg font-semibold text-ash-ink">{t({ es: points.length === 1 ? 'provincia' : 'provincias', en: points.length === 1 ? 'province' : 'provinces' })}</span>
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {points.slice(0, 10).map((p) => (
                  <li key={p.province} className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm text-ink/80 ring-1 ring-line">
                    <span aria-hidden className="size-2 rounded-full bg-chef" />
                    {p.province}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Reveal>
        <PurchaseGlobe
          points={points.map(({ lat, lng, orders }) => ({ lat, lng, orders }))}
          label={
            hasOrders
              ? t({ es: `Bola del mundo con pedidos desde: ${points.map((p) => p.province).join(', ')}`, en: `Globe with orders from: ${points.map((p) => p.province).join(', ')}` })
              : t({ es: 'Bola del mundo centrada en España', en: 'Globe centred on Spain' })
          }
        />
      </div>
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

export async function StoreIntro() {
  const { t } = await getI18n()
  return (
    <section className="container-page pt-6 pb-10 sm:pt-10">
      <Reveal className="flex flex-col justify-between gap-6 border-t border-line pt-10 lg:flex-row lg:items-end">
        <h2 className="max-w-3xl font-display text-[34px] leading-[1.08] font-extrabold tracking-tight sm:text-5xl">
          {t({ es: 'Tienda.', en: 'Shop.' })}{' '}
          <span className="text-chef">{t({ es: 'La forma más rica de aprender a cocinar.', en: 'The tastiest way to learn to cook.' })}</span>
        </h2>
        <div className="flex items-center gap-3">
          <ButtonLink href="/tienda" variant="secondary" size="sm">
            {t({ es: 'Ver todos los kits', en: 'See all kits' })} <ArrowRightIcon size={15} />
          </ButtonLink>
        </div>
      </Reveal>
    </section>
  )
}
