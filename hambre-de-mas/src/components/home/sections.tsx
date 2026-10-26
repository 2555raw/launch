import Image from 'next/image'
import Link from 'next/link'
import { NewsletterForm } from '@/components/layout/newsletter-form'
import { Reveal, RevealLi } from '@/components/motion/reveal'
import { ProductCard } from '@/components/product/product-card'
import { ButtonLink } from '@/components/ui/button'
import { ArrowRightIcon, ChevronRightIcon, LeafIcon, PlayIcon, ReturnIcon, ShieldIcon, StarIcon, TruckIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { Scroller } from '@/components/ui/scroller'
import { cn } from '@/lib/cn'
import { commerce } from '@/lib/config/commerce'
import { formatPrice } from '@/lib/money'
import type { Category, ProductSummary, Review } from '@/lib/types'

/** Titular de sección de dos tonos, al estilo de la Apple Store. */
export function SectionTitle({ strong, soft, id, action }: { strong: string; soft?: string; id?: string; action?: React.ReactNode }) {
  return (
    <div className="container-page mb-6 flex items-end justify-between gap-6">
      <h2 id={id} className="max-w-3xl font-display text-[28px] leading-tight font-bold tracking-tight sm:text-[34px]">
        {strong} {soft && <span className="text-ash">{soft}</span>}
      </h2>
      {action}
    </div>
  )
}

const levelStyles: Record<Category['accent'], { ring: string; chip: string }> = {
  chef: { ring: 'bg-chef', chip: 'text-teja' },
  hoja: { ring: 'bg-hoja', chip: 'text-hoja-ink' },
  teja: { ring: 'bg-teja', chip: 'text-teja' },
  almendra: { ring: 'bg-almendra', chip: 'text-teja' },
}

export function LevelsRow({ categories }: { categories: Category[] }) {
  return (
    <section aria-labelledby="niveles" className="pt-6 pb-4">
      <SectionTitle id="niveles" strong="Elige tu nivel." soft="Empieza sin fuego y acaba cocinando el mundo." />
      <Scroller label="Niveles de cocina">
        {categories.map((c, i) => (
          <Reveal key={c.slug} delay={i * 0.06} className="snap-start">
            <Link href={`/categoria/${c.slug}`} className="group flex w-[150px] flex-col items-center text-center sm:w-[176px]">
              <span className="relative block size-[120px] sm:size-[140px]">
                <span className={cn('absolute inset-0 rounded-full opacity-90 transition-transform duration-500 group-hover:scale-105', levelStyles[c.accent].ring)} />
                <span className="absolute inset-[6px] overflow-hidden rounded-full bg-mist">
                  {c.imageUrl && (
                    <Image
                      src={c.imageUrl}
                      alt=""
                      fill
                      sizes="140px"
                      className="object-cover transition-transform duration-700 ease-[var(--ease-apple)] group-hover:scale-110"
                    />
                  )}
                </span>
              </span>
              <span className={cn('mt-4 text-[11px] font-semibold tracking-wide uppercase', levelStyles[c.accent].chip)}>
                {c.level ? `Nivel ${c.level}` : 'Cada mes'}
              </span>
              <span className="text-[15px] font-semibold">{c.name}</span>
              <span className="text-xs text-ash-ink">{c.tagline}</span>
            </Link>
          </Reveal>
        ))}
      </Scroller>
    </section>
  )
}

/** Tarjeta grande para el carrusel de novedades. */
function FeatureCard({ product, tone }: { product: ProductSummary; tone: 'light' | 'dark' }) {
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
          {product.badge ?? 'Nuevo'}
        </p>
        <h3 className="mt-2 font-display text-[26px] leading-tight font-bold">{product.name}</h3>
        <p className={cn('mt-2 line-clamp-2 text-[15px]', tone === 'dark' ? 'text-white/70' : 'text-ash-ink')}>{product.subtitle}</p>
        <p className="mt-3 text-[15px] tabular-nums">Desde {formatPrice(product.priceCents)}</p>
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

export function NewArrivals({ products }: { products: ProductSummary[] }) {
  if (products.length === 0) return null
  return (
    <section aria-labelledby="novedades" className="bg-mist pt-16 pb-6">
      <SectionTitle
        id="novedades"
        strong="Lo último."
        soft="Recién salido del horno."
        action={
          <Link href="/tienda?orden=novedades" className="hidden shrink-0 items-center gap-1 text-[15px] text-teja hover:underline sm:inline-flex">
            Ver novedades <ChevronRightIcon size={16} />
          </Link>
        }
      />
      <Scroller label="Novedades">
        {products.map((p, i) => (
          <FeatureCard key={p.id} product={p} tone={i % 3 === 1 ? 'dark' : 'light'} />
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

export function BestSellers({ products }: { products: ProductSummary[] }) {
  if (products.length === 0) return null
  return (
    <section aria-labelledby="mas-vendidos" className="bg-mist py-16">
      <SectionTitle id="mas-vendidos" strong="Los más vendidos." soft="Lo que más se cocina este mes." />
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
                      {p.category?.level ? `Nivel ${p.category.level}` : p.category?.name}
                    </span>
                    <span className="block truncate font-semibold sm:text-[17px]">{p.name}</span>
                    <span className="block text-sm text-ash-ink tabular-nums">Desde {formatPrice(p.priceCents)}</span>
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
  { n: 1, title: 'Eliges tu kit', text: 'En la tienda, según tu nivel y lo que te apetezca.' },
  { n: 2, title: 'Te llega a casa', text: 'Ingredientes secos, especias y la receta con un QR al vídeo.' },
  { n: 3, title: 'Cocinas y subes', text: 'Sigues el vídeo, completas el nivel y desbloqueas el siguiente.' },
]

export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="py-20 sm:py-28">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <p className="eyebrow">Cómo funciona</p>
          <h2 id="como-funciona-titulo" className="mt-3 font-display text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">
            Aprender a cocinar como si fuera un videojuego.
          </h2>
          <p className="mt-5 max-w-lg text-lg text-ash-ink">
            Superas niveles y desbloqueas recetas nuevas. Sin listas de la compra imposibles: lo difícil de encontrar ya va en la caja.
          </p>
          <ol className="mt-10 space-y-4">
            {steps.map((s, i) => (
              <RevealLi key={s.n} delay={0.1 + i * 0.08} className="flex gap-5 rounded-[22px] bg-almendra-soft p-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-chef-ink font-display text-lg font-extrabold text-white">
                    {s.n}
                  </span>
                  <span>
                    <span className="block font-display text-lg font-bold text-teja">{s.title}</span>
                    <span className="block text-[15px] text-ink/80">{s.text}</span>
                  </span>
              </RevealLi>
            ))}
          </ol>
        </Reveal>
        <Reveal delay={0.1} className="relative">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[36px] bg-mist shadow-float sm:aspect-[5/6]">
            <Image src="/demo/home/ingredientes.jpg" alt="Ingredientes frescos sobre una tabla de madera" fill sizes="(min-width: 1024px) 45vw, 92vw" className="object-cover" />
          </div>
          <div className="absolute -bottom-6 -left-2 flex items-center gap-3 rounded-[20px] bg-white p-4 pr-6 shadow-float sm:-left-8">
            <span className="grid size-11 place-items-center rounded-2xl bg-ink text-white">
              <PlayIcon size={22} />
            </span>
            <span>
              <span className="block text-sm font-semibold">Escanea el QR</span>
              <span className="block text-xs text-ash-ink">y cocina con el vídeo paso a paso</span>
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function BrandStory() {
  return (
    <section aria-labelledby="marca" className="px-3 sm:px-6">
      <div className="relative mx-auto max-w-[88rem] overflow-hidden rounded-[40px] bg-almendra px-6 py-16 sm:px-12 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.2fr]">
          <Reveal className="flex justify-center">
            <Image src="/brand/logo-720.png" alt="Logotipo de Hambre de Más: un gorro de chef con el nombre en curva" width={720} height={653} className="w-full max-w-[380px]" />
          </Reveal>
          <Reveal delay={0.1}>
            <p className="eyebrow">Nuestra marca</p>
            <h2 id="marca" className="mt-3 font-display text-4xl leading-[1.05] font-extrabold tracking-tight text-teja sm:text-5xl">
              ¿Con hambre de más?
            </h2>
            <p className="mt-5 text-lg text-teja/90">
              Somos una tienda de kits de cocina para chavales de 12 a 18 años. El nombre juega con un doble sentido:
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[22px] bg-white/70 p-6">
                <p className="font-display text-xl font-bold text-chef">Hambre de comida</p>
                <p className="mt-2 text-[15px] text-teja/90">Siempre tenéis hambre. Se entiende al instante y conecta con vuestro día a día.</p>
              </div>
              <div className="rounded-[22px] bg-white/70 p-6">
                <p className="font-display text-xl font-bold text-chef">Hambre de más</p>
                <p className="mt-2 text-[15px] text-teja/90">Ganas de aprender, de ser independientes, de probar sabores nuevos y de subir de nivel.</p>
              </div>
            </div>
            <p className="mt-6 flex items-start gap-2 text-sm text-teja/80">
              <LeafIcon size={18} className="mt-0.5 shrink-0 text-hoja-ink" />
              El detalle escondido: la H de «Hambre» esconde un tenedor y la tilde de «Más» es una hoja. Comida fresca y de verdad.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export function Benefits() {
  const items = [
    {
      icon: TruckIcon,
      title: commerce.freeShippingThresholdCents > 0 ? `Envío gratis desde ${formatPrice(commerce.freeShippingThresholdCents).replace(',00', '')}` : 'Envío gratis',
      text: `A Península y Baleares en ${commerce.deliveryEstimate}.`,
    },
    { icon: ShieldIcon, title: 'Pago seguro', text: 'En la pasarela de Stripe. Nunca vemos ni guardamos tu tarjeta.' },
    { icon: ReturnIcon, title: 'Devoluciones fáciles', text: `${commerce.returnDays} días para productos sin abrir.` },
    { icon: PlayIcon, title: 'Vídeo paso a paso', text: 'Cada kit trae un QR con el vídeo de la receta.' },
  ]
  return (
    <section aria-label="Ventajas de comprar en Hambre de Más" className="py-20">
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

export function VerifiedReviews({ reviews }: { reviews: (Review & { productName: string; productSlug: string })[] }) {
  if (reviews.length === 0) return null
  return (
    <section aria-labelledby="opiniones" className="bg-mist py-16">
      <SectionTitle id="opiniones" strong="Opiniones verificadas." soft="Solo de quien ha comprado y cocinado el kit." />
      <ul className="container-page grid gap-5 md:grid-cols-3">
        {reviews.map((r) => (
          <li key={r.id} className="flex flex-col rounded-[22px] bg-white p-6 shadow-card">
            <div className="flex gap-0.5 text-chef" aria-label={`${r.rating} de 5 estrellas`}>
              {Array.from({ length: 5 }, (_, i) => (
                <StarIcon key={i} size={16} filled={i < r.rating} />
              ))}
            </div>
            {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
            <p className="mt-2 line-clamp-5 text-[15px] text-ink/80">{r.body}</p>
            <p className="mt-auto pt-4 text-xs text-ash-ink">
              {r.authorName} · compra verificada ·{' '}
              <Link href={`/producto/${r.productSlug}`} className="text-teja hover:underline">
                {r.productName}
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function NewsletterSection() {
  return (
    <section aria-labelledby="newsletter" className="px-3 pb-16 sm:px-6">
      <div className="mx-auto flex max-w-[88rem] flex-col items-center rounded-[40px] bg-mist px-6 py-16 text-center sm:py-20">
        <p className="eyebrow">Newsletter</p>
        <h2 id="newsletter" className="mt-3 max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          Recetas nuevas antes que nadie.
        </h2>
        <p className="mt-3 max-w-lg text-ash-ink">Un email al mes con los kits que llegan, retos de cocina y algún código de descuento.</p>
        <div className="mt-8 flex w-full justify-center text-left">
          <NewsletterForm />
        </div>
      </div>
    </section>
  )
}

export function StoreIntro() {
  return (
    <section className="container-page pt-6 pb-10 sm:pt-10">
      <Reveal className="flex flex-col justify-between gap-6 border-t border-line pt-10 lg:flex-row lg:items-end">
        <h2 className="max-w-3xl font-display text-[34px] leading-[1.08] font-extrabold tracking-tight sm:text-5xl">
          Tienda. <span className="text-ash">La forma más rica de aprender a cocinar.</span>
        </h2>
        <div className="flex items-center gap-3">
          <ButtonLink href="/tienda" variant="secondary" size="sm">
            Ver todos los kits <ArrowRightIcon size={15} />
          </ButtonLink>
        </div>
      </Reveal>
    </section>
  )
}
