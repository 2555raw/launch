import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Reveal } from '@/components/motion/reveal'
import { AllergenList, AllergenStrip } from '@/components/product/allergen-icons'
import { Gallery } from '@/components/product/gallery'
import { LevelBars } from '@/components/home/levels-showcase'
import { KitContents } from '@/components/product/kit-contents'
import { StorageChip } from '@/components/product/storage-chip'
import { recipeQrSvg } from '@/lib/recipes/qr'
import { ProductBadge } from '@/components/product/product-badge'
import { ProductCard } from '@/components/product/product-card'
import { PurchasePanel } from '@/components/product/purchase-panel'
import { ReviewAuthor } from '@/components/product/review-author'
import { ReviewForm } from '@/components/product/review-form'
import { JsonLd } from '@/components/seo/json-ld'
import { ChevronRightIcon, ClockIcon, DumbbellIcon, FlameIcon, GiftIcon, LeafIcon, QrIcon, ReturnIcon, StarIcon, TruckIcon } from '@/components/ui/icons'
import { LevelChip } from '@/components/ui/level-chip'
import { getCatalog } from '@/lib/catalog'
import { cn } from '@/lib/cn'
import { commerce } from '@/lib/config/commerce'
import { site } from '@/lib/config/site'
import { getI18n } from '@/lib/i18n/server'
import type { Localized } from '@/lib/i18n/config'
import { formatDate, formatPrice } from '@/lib/money'
import type { Heat, Nutrition } from '@/lib/types'
import { dayLabel, isPreorder } from '@/lib/preorder'

export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

/** Genera en el build las fichas existentes; las nuevas se generan al primer acceso (ISR). */
export async function generateStaticParams() {
  try {
    const { products } = await getCatalog().listSitemapEntries()
    return products.map((p) => ({ slug: p.slug }))
  } catch {
    return []
  }
}

const heatLabel: Record<Heat, Localized> = {
  'sin-fuego': { es: 'Sin fuego', en: 'No heat' },
  microondas: { es: 'Microondas', en: 'Microwave' },
  sarten: { es: 'Sartén', en: 'Frying pan' },
  cazo: { es: 'Cazo', en: 'Pot' },
  horno: { es: 'Horno', en: 'Oven' },
}
const difficultyLabel: Localized[] = [
  { es: '', en: '' },
  { es: 'Fácil', en: 'Easy' },
  { es: 'Media', en: 'Medium' },
  { es: 'Reto', en: 'Challenge' },
]
const tagLabel: Record<string, Localized> = {
  vegano: { es: 'Vegano', en: 'Vegan' },
  vegetariano: { es: 'Vegetariano', en: 'Vegetarian' },
  'sin-gluten': { es: 'Sin gluten', en: 'Gluten-free' },
  picante: { es: 'Picante', en: 'Spicy' },
  'alto-en-proteina': { es: 'Alto en proteína', en: 'High protein' },
}

/** Valores nutricionales aproximados por ración: calorías, proteína, hidratos y grasas. */
async function NutritionPanel({ nutrition }: { nutrition: Nutrition }) {
  const { t } = await getI18n()
  const items = [
    { value: nutrition.kcal, unit: 'kcal', label: t({ es: 'Calorías', en: 'Calories' }), strong: true },
    { value: nutrition.protein, unit: 'g', label: t({ es: 'Proteína', en: 'Protein' }) },
    { value: nutrition.carbs, unit: 'g', label: t({ es: 'Hidratos', en: 'Carbs' }) },
    { value: nutrition.fat, unit: 'g', label: t({ es: 'Grasas', en: 'Fat' }) },
  ]
  return (
    <div className="mt-6">
      <p className="text-[13px] font-semibold">
        {t({ es: 'Valores nutricionales', en: 'Nutrition' })}{' '}
        <span className="font-normal text-ash-ink">· {t({ es: 'por ración, aprox.', en: 'per serving, approx.' })}</span>
      </p>
      <dl className="mt-2 grid grid-cols-4 gap-2">
        {items.map((item) => (
          <div key={item.label} className={cn('flex flex-col-reverse rounded-2xl px-3 py-2.5', item.strong ? 'bg-ink text-white' : 'bg-mist')}>
            <dt className={cn('text-[11px]', item.strong ? 'text-white/70' : 'text-ash-ink')}>{item.label}</dt>
            <dd className="font-display text-lg leading-tight font-extrabold tabular-nums">
              {item.value}
              <span className={cn('ml-0.5 text-xs font-semibold', item.strong ? 'text-white/60' : 'text-ash-ink')}>{item.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getCatalog().getProduct(slug)
  const { t } = await getI18n()
  if (!product) return { title: t({ es: 'Producto no encontrado', en: 'Product not found' }) }
  const description = product.seoDescription ?? product.subtitle ?? product.description.slice(0, 160)
  return {
    title: product.seoTitle ?? product.name,
    description,
    alternates: { canonical: `/producto/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      images: product.images.slice(0, 1).map((i) => ({ url: i.url, alt: i.alt })),
    },
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params
  const catalog = getCatalog()
  const product = await catalog.getProduct(slug)
  if (!product) notFound()
  const [related, reviews, qrSvg, level] = await Promise.all([
    catalog.listRelated(product, 4),
    catalog.listReviews(product.id),
    product.recipe.steps.length ? recipeQrSvg(product.slug) : Promise.resolve(null),
    product.category ? catalog.getCategory(product.category.slug) : Promise.resolve(null),
  ])
  const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  const { locale, t } = await getI18n()
  const reviewCount = (n: number) => t({ es: `${n} ${n === 1 ? 'opinión' : 'opiniones'}`, en: `${n} ${n === 1 ? 'review' : 'reviews'}` })
  const absolute = (url: string) => (url.startsWith('http') ? url : `${site.url}${url}`)

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.subtitle ?? product.description,
          image: product.images.map((i) => absolute(i.url)),
          sku: product.variants[0]?.sku,
          brand: { '@type': 'Brand', name: site.name },
          category: product.category?.name,
          offers: product.variants.map((v) => ({
            '@type': 'Offer',
            sku: v.sku,
            name: `${product.name} · ${v.name}`,
            price: (v.priceCents / 100).toFixed(2),
            priceCurrency: 'EUR',
            availability: v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: `${site.url}/producto/${product.slug}`,
            itemCondition: 'https://schema.org/NewCondition',
          })),
          ...(reviews.length
            ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: average.toFixed(1), reviewCount: reviews.length } }
            : {}),
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: t({ es: 'Tienda', en: 'Shop' }), item: `${site.url}/tienda` },
            ...(product.category
              ? [{ '@type': 'ListItem', position: 2, name: product.category.name, item: `${site.url}/categoria/${product.category.slug}` }]
              : []),
            { '@type': 'ListItem', position: product.category ? 3 : 2, name: product.name, item: `${site.url}/producto/${product.slug}` },
          ],
        }}
      />

      <div className="container-page pt-6 pb-20">
        <nav aria-label={t({ es: 'Migas de pan', en: 'Breadcrumb' })} className="mb-6 text-[13px] text-ash-ink">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/tienda" className="hover:text-ink">
                {t({ es: 'Tienda', en: 'Shop' })}
              </Link>
            </li>
            {product.category && (
              <li className="flex items-center gap-1">
                <ChevronRightIcon size={12} />
                <Link href={`/categoria/${product.category.slug}`} className="hover:text-ink">
                  {product.category.name}
                </Link>
              </li>
            )}
            <li className="flex items-center gap-1" aria-current="page">
              <ChevronRightIcon size={12} />
              <span className="text-ink">{product.name}</span>
            </li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <Gallery images={product.images} name={product.name} />

          <div>
            <div className="flex flex-wrap items-center gap-2">
              {product.category && <LevelChip level={product.category.level} accent={product.category.accent} name={product.category.name} hint={level?.tagline} />}
              {product.badge && <ProductBadge badge={product.badge} />}
            </div>
            <h1 className="mt-3 font-display text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">{product.name}</h1>
            {product.subtitle && <p className="mt-3 text-lg text-ash-ink">{product.subtitle}</p>}
            {level?.level && level.description && (
              <Link href={`/categoria/${level.slug}`} className="group mt-4 flex items-start gap-3 rounded-2xl bg-almendra-soft px-4 py-3 text-sm text-ink/80">
                <span className="mt-0.5 shrink-0 text-teja">
                  <LevelBars level={level.level} />
                </span>
                <span>
                  <strong className="text-teja">{level.name}.</strong> {level.description}{' '}
                  <span className="whitespace-nowrap text-teja group-hover:underline">{t({ es: 'Ver los kits', en: 'See the kits' })} →</span>
                </span>
              </Link>
            )}
            {reviews.length > 0 && (
              <a href="#opiniones" className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink">
                <StarIcon size={15} className="text-chef" /> {average.toFixed(1)} · {reviewCount(reviews.length)}
              </a>
            )}

            <ul className="mt-6 flex flex-wrap gap-2 text-[13px]">
              {product.attributes.minutes ? (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1.5">
                  <ClockIcon size={15} /> {product.attributes.minutes} min
                </li>
              ) : null}
              {product.attributes.heat && (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1.5">
                  <FlameIcon size={15} /> {t(heatLabel[product.attributes.heat])}
                </li>
              )}
              {product.attributes.difficulty ? (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1.5">{t({ es: 'Dificultad', en: 'Difficulty' })}: {t(difficultyLabel[product.attributes.difficulty] ?? difficultyLabel[0]!)}
                </li>
              ) : null}
              <li>
                <StorageChip storage={product.attributes.storage} />
              </li>
              {product.tags.map((tag) =>
                tag === 'alto-en-proteina' ? (
                  <li key={tag} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 font-medium text-white">
                    <DumbbellIcon size={15} /> {t(tagLabel[tag]!)}
                    {product.attributes.nutrition ? (
                      <span className="text-white/70">
                        · {t({ es: `${product.attributes.nutrition.protein} g/ración`, en: `${product.attributes.nutrition.protein} g/serving` })}
                      </span>
                    ) : null}
                  </li>
                ) : (
                  <li key={tag} className="inline-flex items-center gap-1.5 rounded-full bg-hoja/15 px-3 py-1.5 text-hoja-deep">
                    <LeafIcon size={14} /> {tagLabel[tag] ? t(tagLabel[tag]) : tag}
                  </li>
                ),
              )}
            </ul>

            {product.attributes.nutrition && <NutritionPanel nutrition={product.attributes.nutrition} />}
            {product.category?.level ? (
              <Link href={`/comparar?kits=${product.slug}`} className="mt-3 inline-block text-sm font-medium text-teja hover:underline">
                {t({ es: 'Comparar con otros kits →', en: 'Compare with other kits →' })}
              </Link>
            ) : null}

            {product.allergens.length > 0 ? (
              <a href="#alergenos" className="group mt-5 block text-sm text-ash-ink">
                <AllergenStrip codes={product.allergens} traces={product.allergenTraces} size={26} layout="row" />
                <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-chef" /> {t({ es: 'Contiene', en: 'Contains' })}
                  </span>
                  {product.allergenTraces.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full bg-chef/45" /> {t({ es: 'Trazas', en: 'Traces' })}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#C7C7CC]" /> {t({ es: 'No contiene', en: 'Free from' })}
                  </span>
                  <span className="text-teja underline-offset-2 group-hover:underline">{t({ es: 'Ver alérgenos', en: 'See allergens' })}</span>
                </span>
              </a>
            ) : (
              <a href="#alergenos" className="mt-5 inline-block text-sm text-ash-ink hover:text-ink">
                {t({ es: 'Alérgenos: consulta la información del kit', en: 'Allergens: see the kit information' })}{' '}
                <span className="text-teja underline-offset-2 hover:underline">{t({ es: 'Ver alérgenos', en: 'See allergens' })}</span>
              </a>
            )}

            <div className="mt-8 border-t border-line pt-8">
              <PurchasePanel product={product} />
            </div>

            <ul className="mt-8 divide-y divide-line rounded-[20px] bg-mist px-5 text-sm">
              {product.category?.level && commerce.bundleMinKits > 0 && commerce.bundlePercent > 0 && (
                <li className="flex gap-3 py-4">
                  <GiftIcon className="mt-0.5 shrink-0 text-chef" />
                  <span>
                    <strong className="font-semibold">
                      {t({
                        es: `Pack ${product.category.name}: ${commerce.bundleMinKits} kits, −${commerce.bundlePercent} %`,
                        en: `${product.category.name} bundle: ${commerce.bundleMinKits} kits, ${commerce.bundlePercent}% off`,
                      })}
                    </strong>
                    <span className="block text-ash-ink">
                      {t({
                        es: `Llévate ${commerce.bundleMinKits} kits de este nivel (o más) y se descuenta solo en la cesta.`,
                        en: `Take ${commerce.bundleMinKits} or more kits from this level and the discount applies automatically in your bag.`,
                      })}{' '}
                      {(
                        <Link href={`/categoria/${product.category.slug}`} className="text-teja hover:underline">
                          {t({ es: 'Ver kits del nivel', en: 'See level kits' })}
                        </Link>
                      )}
                    </span>
                  </span>
                </li>
              )}
              <li className="flex gap-3 py-4">
                <TruckIcon className="mt-0.5 shrink-0" />
                <span>
                  <strong className="font-semibold">
                    {product.attributes.preorder && isPreorder(product.attributes)
                      ? t({
                          es: `Sale el ${dayLabel(product.attributes.preorder.releaseDate, locale)}`,
                          en: `Out on ${dayLabel(product.attributes.preorder.releaseDate, locale)}`,
                        })
                      : t({
                          es: `Envío en ${commerce.deliveryEstimate}`,
                          en: `Delivery in ${commerce.deliveryEstimate.replace('h laborables', 'working hours')}`,
                        })}
                  </strong>
                  <span className="block text-ash-ink">
                    {t({
                      es: `${formatPrice(commerce.shippingCents)} a Península y Baleares. Gratis desde ${formatPrice(commerce.freeShippingThresholdCents)}.`,
                      en: `${formatPrice(commerce.shippingCents, 'en')} to mainland Spain and the Balearic Islands. Free from ${formatPrice(commerce.freeShippingThresholdCents, 'en')}.`,
                    })}{' '}
                    <Link href="/legal/envios" className="text-teja hover:underline">
                      {t({ es: 'Más info', en: 'More info' })}
                    </Link>
                  </span>
                </span>
              </li>
              <li className="flex gap-3 py-4">
                <ReturnIcon className="mt-0.5 shrink-0" />
                <span>
                  <strong className="font-semibold">{t({ es: 'Devoluciones', en: 'Returns' })}</strong>
                  <span className="block text-ash-ink">
                    {t({
                      es: `${commerce.returnDays} días para kits sin abrir. Los alimentos abiertos no se pueden devolver por higiene.`,
                      en: `${commerce.returnDays} days for unopened kits. Opened food can't be returned for hygiene reasons.`,
                    })}{' '}
                    <Link href="/legal/devoluciones" className="text-teja hover:underline">
                      {t({ es: 'Ver condiciones', en: 'See terms' })}
                    </Link>
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {qrSvg && (
          <section aria-labelledby="receta-qr" className="mt-20 overflow-hidden rounded-[32px] bg-chef-ink text-white">
            <div className="grid items-center gap-8 p-8 sm:p-12 md:grid-cols-[1fr_auto]">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-almendra uppercase">
                  <QrIcon size={16} /> {t({ es: 'La receta, en el móvil', en: 'The recipe, on your phone' })}
                </p>
                <h2 id="receta-qr" className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {t({ es: 'Escanéalo y cocina paso a paso.', en: 'Scan it and cook step by step.' })}
                </h2>
                <p className="mt-3 max-w-lg text-white/85">
                  {t({
                    es: 'Es el mismo QR que viene impreso en la tarjeta de tu kit. Ábrelo con la cámara del móvil y tendrás la receta con todos los pasos, lo que pones tú y los alérgenos.',
                    en: "It's the same QR printed on your kit's card. Open it with your phone camera to get the recipe with every step, what you add and the allergens.",
                  })}
                </p>
                <Link href={`/receta/${product.slug}`} className="mt-6 inline-flex items-center gap-2 font-semibold text-white underline underline-offset-4">
                  {t({ es: 'Ver la receta aquí', en: 'See the recipe here' })} →
                </Link>
              </div>
              <div className="kit-pop mx-auto w-52 rotate-[-4deg] rounded-[24px] bg-white px-4 pt-4 pb-3 text-ink shadow-float sm:w-60 md:mr-8 lg:mr-14">
                <p className="text-center text-[11px] font-extrabold tracking-wider text-teja">
                  {t({ es: 'RECETA', en: 'RECIPE' })} · {product.name.replace(/^Kit\s+|\s+kit$/gi, '').toUpperCase()}
                </p>
                <div className="mx-auto mt-2 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label={t({ es: `Código QR de la receta de ${product.name}`, en: `QR code for the ${product.name} recipe` })} dangerouslySetInnerHTML={{ __html: qrSvg }} />
              </div>
            </div>
          </section>
        )}

        <div className="mt-20 grid gap-12 border-t border-line pt-16 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          <Reveal>
            <h2 className="font-display text-3xl font-extrabold tracking-tight">{t({ es: 'Qué trae el kit', en: "What's in the kit" })}</h2>
            <p className="mt-2 text-[15px] text-ash-ink">
              {t({ es: 'Las especias vienen en sobres individuales, ya pesados para la receta.', en: 'Spices come in single sachets, pre-weighed for the recipe.' })}
            </p>
            <div className="mt-6">
              <KitContents items={product.includes} images={product.includeImages} storage={product.attributes.storage} />
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="font-display text-3xl font-extrabold tracking-tight">{t({ es: 'La receta', en: 'The recipe' })}</h2>
            <p className="mt-6 text-[17px] leading-relaxed text-ink/85">{product.description}</p>
            {product.specs.length > 0 && (
              <>
                <h3 className="mt-10 mb-2 text-[15px] font-semibold">{t({ es: 'Información técnica', en: 'Product details' })}</h3>
                <dl className="divide-y divide-line border-y border-line text-sm">
                  {product.specs.map((s) => (
                    <div key={s.label} className="grid grid-cols-[140px_1fr] gap-4 py-3 sm:grid-cols-[180px_1fr]">
                      <dt className="text-ash-ink">{s.label}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                  <div className="grid grid-cols-[140px_1fr] gap-4 py-3 sm:grid-cols-[180px_1fr]">
                    <dt className="text-ash-ink">{t({ es: 'IVA', en: 'VAT' })}</dt>
                    <dd>{t({ es: `${product.taxRateBps / 100} % incluido en el precio`, en: `${product.taxRateBps / 100}% included in the price` })}</dd>
                  </div>
                </dl>
              </>
            )}
          </Reveal>
        </div>

        <section id="alergenos" aria-labelledby="alergenos-titulo" className="mt-20 scroll-mt-24 border-t border-line pt-16">
          <h2 id="alergenos-titulo" className="font-display text-3xl font-extrabold tracking-tight">
            {t({ es: 'Alérgenos', en: 'Allergens' })}
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] text-ash-ink">
            {t({
              es: 'Información de los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011). Revísala siempre antes de cocinar.',
              en: 'Information on the 14 major allergens (EU Regulation 1169/2011). Always check it before cooking.',
            })}
          </p>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-[22px] bg-mist p-6">
              <h3 className="mb-4 font-semibold">{t({ es: 'Contiene el kit', en: 'The kit contains' })}</h3>
              {product.allergens.length ? (
                <AllergenList codes={product.allergens} />
              ) : (
                <p className="text-sm text-ash-ink">{t({ es: 'Ninguno de los 14 alérgenos de declaración obligatoria.', en: 'None of the 14 major allergens.' })}</p>
              )}
            </div>
            <div className="rounded-[22px] bg-mist p-6">
              <h3 className="mb-4 font-semibold">{t({ es: 'Puede contener trazas', en: 'May contain traces' })}</h3>
              {product.allergenTraces.length ? (
                <AllergenList codes={product.allergenTraces} />
              ) : (
                <p className="text-sm text-ash-ink">{t({ es: 'Sin avisos de trazas.', en: 'No trace warnings.' })}</p>
              )}
            </div>
            <div className="rounded-[22px] bg-almendra-soft p-6">
              <h3 className="mb-1 font-semibold">{t({ es: 'Lo que pones tú', en: 'What you add' })}</h3>
              <p className="mb-4 text-xs text-ash-ink">
                {t({ es: 'Alérgenos de los ingredientes frescos que pide la receta.', en: 'Allergens in the fresh ingredients the recipe asks for.' })}
              </p>
              {product.recipeAllergens.length ? (
                <AllergenList codes={product.recipeAllergens} />
              ) : (
                <p className="text-sm text-ash-ink">
                  {t({ es: 'La receta no añade alérgenos de declaración obligatoria.', en: "The recipe doesn't add any major allergens." })}
                </p>
              )}
            </div>
          </div>
        </section>

        <section id="opiniones" aria-labelledby="opiniones-titulo" className="mt-20 border-t border-line pt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="opiniones-titulo" className="font-display text-3xl font-extrabold tracking-tight">
              {t({ es: 'Opiniones verificadas', en: 'Verified reviews' })}
            </h2>
            {reviews.length > 0 && (
              <p className="flex items-center gap-2 text-sm">
                <StarIcon className="text-chef" /> <strong className="text-lg">{average.toFixed(1)}</strong>
                <span className="text-ash-ink">
                  {t({ es: 'de 5', en: 'out of 5' })} · {reviewCount(reviews.length)}
                </span>
              </p>
            )}
          </div>
          {reviews.length === 0 ? (
            <div className="mt-6 flex max-w-2xl flex-col gap-4 rounded-[24px] bg-almendra-soft p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-7">
              <div className="flex shrink-0 gap-1 text-chef" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <StarIcon key={i} size={22} filled={false} />
                ))}
              </div>
              <div>
                <p className="font-display text-xl font-bold">
                  {t({ es: 'Sé el primero en contar qué tal te ha salido.', en: 'Be the first to tell us how it turned out.' })}
                </p>
                <p className="mt-1 text-[15px] text-ash-ink">
                  {t({
                    es: 'Solo publicamos opiniones de personas que han comprado este kit, y las revisamos antes de mostrarlas.',
                    en: 'We only publish reviews from people who bought this kit, and we check them before showing them.',
                  })}
                </p>
              </div>
            </div>
          ) : (
            <ul className="mt-8 grid gap-5 md:grid-cols-2">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-[22px] bg-mist p-6">
                  <div className="flex gap-0.5 text-chef" aria-label={t({ es: `${r.rating} de 5 estrellas`, en: `${r.rating} out of 5 stars` })}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <StarIcon key={i} size={15} filled={i < r.rating} />
                    ))}
                  </div>
                  {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
                  <p className="mt-2 text-[15px] text-ink/80">{r.body}</p>
                  <div className="mt-5">
                    <ReviewAuthor
                      name={r.authorName}
                      verifiedLabel={r.isVerified ? t({ es: 'Compra verificada', en: 'Verified purchase' }) : null}
                      meta={
                        <>
                          <span aria-hidden>·</span>
                          {formatDate(r.createdAt, locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                        </>
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <ReviewForm productId={product.id} productSlug={product.slug} />
        </section>

        {related.length > 0 && (
          <section aria-labelledby="relacionados" className="mt-20 border-t border-line pt-16">
            <h2 id="relacionados" className="mb-8 font-display text-3xl font-extrabold tracking-tight">
              {t({ es: 'También te puede flipar', en: 'You might also love' })}
            </h2>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  )
}
