import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Reveal } from '@/components/motion/reveal'
import { AllergenList, AllergenStrip } from '@/components/product/allergen-icons'
import { Gallery } from '@/components/product/gallery'
import { KitContents } from '@/components/product/kit-contents'
import { StorageChip } from '@/components/product/storage-chip'
import { recipeQrSvg } from '@/lib/recipes/qr'
import { ProductCard } from '@/components/product/product-card'
import { PurchasePanel } from '@/components/product/purchase-panel'
import { ReviewForm } from '@/components/product/review-form'
import { JsonLd } from '@/components/seo/json-ld'
import { ChevronRightIcon, ClockIcon, FlameIcon, LeafIcon, QrIcon, ReturnIcon, StarIcon, TruckIcon } from '@/components/ui/icons'
import { LevelChip } from '@/components/ui/level-chip'
import { getCatalog } from '@/lib/catalog'
import { commerce } from '@/lib/config/commerce'
import { site } from '@/lib/config/site'
import { formatPrice } from '@/lib/money'
import type { Heat } from '@/lib/types'

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

const heatLabel: Record<Heat, string> = {
  'sin-fuego': 'Sin fuego',
  microondas: 'Microondas',
  sarten: 'Sartén',
  cazo: 'Cazo',
  horno: 'Horno',
}
const difficultyLabel = ['', 'Fácil', 'Media', 'Reto']
const tagLabel: Record<string, string> = { vegano: 'Vegano', vegetariano: 'Vegetariano', 'sin-gluten': 'Sin gluten', picante: 'Picante' }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const product = await getCatalog().getProduct(slug)
  if (!product) return { title: 'Producto no encontrado' }
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
  const [related, reviews, qrSvg] = await Promise.all([
    catalog.listRelated(product, 4),
    catalog.listReviews(product.id),
    product.recipe.steps.length ? recipeQrSvg(product.slug) : Promise.resolve(null),
  ])
  const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
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
            { '@type': 'ListItem', position: 1, name: 'Tienda', item: `${site.url}/tienda` },
            ...(product.category
              ? [{ '@type': 'ListItem', position: 2, name: product.category.name, item: `${site.url}/categoria/${product.category.slug}` }]
              : []),
            { '@type': 'ListItem', position: product.category ? 3 : 2, name: product.name, item: `${site.url}/producto/${product.slug}` },
          ],
        }}
      />

      <div className="container-page pt-6 pb-20">
        <nav aria-label="Migas de pan" className="mb-6 text-[13px] text-ash-ink">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href="/tienda" className="hover:text-ink">
                Tienda
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
              {product.category && <LevelChip level={product.category.level} accent={product.category.accent} name={product.category.name} />}
              {product.badge && <span className="text-[12px] font-semibold text-teja">{product.badge}</span>}
              {product.isDemo && (
                <span className="rounded-full bg-mist px-2.5 py-0.5 text-[11px] font-medium text-ash-ink" title="Producto de ejemplo para la demo de la tienda">
                  Producto de demostración
                </span>
              )}
            </div>
            <h1 className="mt-3 font-display text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl">{product.name}</h1>
            {product.subtitle && <p className="mt-3 text-lg text-ash-ink">{product.subtitle}</p>}
            {reviews.length > 0 && (
              <a href="#opiniones" className="mt-3 inline-flex items-center gap-1.5 text-sm text-ink">
                <StarIcon size={15} className="text-chef" /> {average.toFixed(1)} · {reviews.length} {reviews.length === 1 ? 'opinión' : 'opiniones'}
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
                  <FlameIcon size={15} /> {heatLabel[product.attributes.heat]}
                </li>
              )}
              {product.attributes.difficulty ? (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1.5">Dificultad: {difficultyLabel[product.attributes.difficulty]}</li>
              ) : null}
              <li>
                <StorageChip storage={product.attributes.storage} />
              </li>
              {product.tags.map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-hoja/15 px-3 py-1.5 text-hoja-deep">
                  <LeafIcon size={14} /> {tagLabel[t] ?? t}
                </li>
              ))}
            </ul>

            <a href="#alergenos" className="mt-5 flex flex-wrap items-center gap-3 text-sm text-ash-ink hover:text-ink">
              {product.allergens.length > 0 ? (
                <>
                  <span>Contiene:</span>
                  <AllergenStrip codes={product.allergens} max={14} size={26} />
                </>
              ) : (
                <span>Sin alérgenos de declaración obligatoria en el kit</span>
              )}
              <span className="text-teja underline-offset-2 hover:underline">Ver alérgenos</span>
            </a>

            <div className="mt-8 border-t border-line pt-8">
              <PurchasePanel product={product} />
            </div>

            <ul className="mt-8 divide-y divide-line rounded-[20px] bg-mist px-5 text-sm">
              <li className="flex gap-3 py-4">
                <TruckIcon className="mt-0.5 shrink-0" />
                <span>
                  <strong className="font-semibold">Envío en {commerce.deliveryEstimate}</strong>
                  <span className="block text-ash-ink">
                    {formatPrice(commerce.shippingCents)} a Península y Baleares. Gratis desde {formatPrice(commerce.freeShippingThresholdCents)}.{' '}
                    <Link href="/legal/envios" className="text-teja hover:underline">
                      Más info
                    </Link>
                  </span>
                </span>
              </li>
              <li className="flex gap-3 py-4">
                <ReturnIcon className="mt-0.5 shrink-0" />
                <span>
                  <strong className="font-semibold">Devoluciones</strong>
                  <span className="block text-ash-ink">
                    {commerce.returnDays} días para kits sin abrir. Los alimentos abiertos no se pueden devolver por higiene.{' '}
                    <Link href="/legal/devoluciones" className="text-teja hover:underline">
                      Ver condiciones
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
                  <QrIcon size={16} /> La receta, en el móvil
                </p>
                <h2 id="receta-qr" className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Escanéalo y cocina paso a paso.
                </h2>
                <p className="mt-3 max-w-lg text-white/85">
                  Es el mismo QR que viene impreso en la tarjeta de tu kit. Ábrelo con la cámara del móvil y tendrás la receta con todos los
                  pasos, lo que pones tú y los alérgenos.
                </p>
                <Link href={`/receta/${product.slug}`} className="mt-6 inline-flex items-center gap-2 font-semibold text-white underline underline-offset-4">
                  Ver la receta aquí →
                </Link>
              </div>
              <div className="kit-pop mx-auto w-48 rotate-[-4deg] rounded-[22px] bg-white p-4 text-ink shadow-float sm:w-56">
                <p className="text-[11px] font-extrabold tracking-wider text-teja">RECETA · {product.name.replace(/^Kit\s+/i, '').toUpperCase()}</p>
                <div className="mt-2 [&_svg]:h-auto [&_svg]:w-full" role="img" aria-label={`Código QR de la receta de ${product.name}`} dangerouslySetInnerHTML={{ __html: qrSvg }} />
              </div>
            </div>
          </section>
        )}

        <div className="mt-20 grid gap-12 border-t border-line pt-16 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          <Reveal>
            <h2 className="font-display text-3xl font-extrabold tracking-tight">Qué trae el kit</h2>
            <p className="mt-2 text-[15px] text-ash-ink">Las especias vienen en sobres individuales, ya pesados para la receta.</p>
            <div className="mt-6">
              <KitContents items={product.includes} storage={product.attributes.storage} />
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="font-display text-3xl font-extrabold tracking-tight">La receta</h2>
            <p className="mt-6 text-[17px] leading-relaxed text-ink/85">{product.description}</p>
            {product.specs.length > 0 && (
              <>
                <h3 className="mt-10 mb-2 text-[15px] font-semibold">Información técnica</h3>
                <dl className="divide-y divide-line border-y border-line text-sm">
                  {product.specs.map((s) => (
                    <div key={s.label} className="grid grid-cols-[140px_1fr] gap-4 py-3 sm:grid-cols-[180px_1fr]">
                      <dt className="text-ash-ink">{s.label}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                  <div className="grid grid-cols-[140px_1fr] gap-4 py-3 sm:grid-cols-[180px_1fr]">
                    <dt className="text-ash-ink">IVA</dt>
                    <dd>{product.taxRateBps / 100} % incluido en el precio</dd>
                  </div>
                </dl>
              </>
            )}
          </Reveal>
        </div>

        <section id="alergenos" aria-labelledby="alergenos-titulo" className="mt-20 scroll-mt-24 border-t border-line pt-16">
          <h2 id="alergenos-titulo" className="font-display text-3xl font-extrabold tracking-tight">
            Alérgenos
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] text-ash-ink">
            Información de los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011). Revísala siempre antes de cocinar.
          </p>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-[22px] bg-mist p-6">
              <h3 className="mb-4 font-semibold">Contiene el kit</h3>
              {product.allergens.length ? (
                <AllergenList codes={product.allergens} />
              ) : (
                <p className="text-sm text-ash-ink">Ninguno de los 14 alérgenos de declaración obligatoria.</p>
              )}
            </div>
            <div className="rounded-[22px] bg-mist p-6">
              <h3 className="mb-4 font-semibold">Puede contener trazas</h3>
              {product.allergenTraces.length ? (
                <AllergenList codes={product.allergenTraces} />
              ) : (
                <p className="text-sm text-ash-ink">Sin avisos de trazas.</p>
              )}
            </div>
            <div className="rounded-[22px] bg-almendra-soft p-6">
              <h3 className="mb-1 font-semibold">Lo que pones tú</h3>
              <p className="mb-4 text-xs text-ash-ink">Alérgenos de los ingredientes frescos que pide la receta.</p>
              {product.recipeAllergens.length ? (
                <AllergenList codes={product.recipeAllergens} />
              ) : (
                <p className="text-sm text-ash-ink">La receta no añade alérgenos de declaración obligatoria.</p>
              )}
            </div>
          </div>
        </section>

        <section id="opiniones" aria-labelledby="opiniones-titulo" className="mt-20 border-t border-line pt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="opiniones-titulo" className="font-display text-3xl font-extrabold tracking-tight">
              Opiniones verificadas
            </h2>
            {reviews.length > 0 && (
              <p className="flex items-center gap-2 text-sm">
                <StarIcon className="text-chef" /> <strong className="text-lg">{average.toFixed(1)}</strong>
                <span className="text-ash-ink">de 5 · {reviews.length} {reviews.length === 1 ? 'opinión' : 'opiniones'}</span>
              </p>
            )}
          </div>
          {reviews.length === 0 ? (
            <p className="mt-4 max-w-xl text-ash-ink">
              Todavía no hay opiniones. Solo publicamos opiniones de personas que han comprado este kit, y las revisamos antes de mostrarlas.
            </p>
          ) : (
            <ul className="mt-8 grid gap-5 md:grid-cols-2">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-[22px] bg-mist p-6">
                  <div className="flex gap-0.5 text-chef" aria-label={`${r.rating} de 5 estrellas`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <StarIcon key={i} size={15} filled={i < r.rating} />
                    ))}
                  </div>
                  {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
                  <p className="mt-2 text-[15px] text-ink/80">{r.body}</p>
                  <p className="mt-4 text-xs text-ash-ink">
                    {r.authorName} · Compra verificada · {new Date(r.createdAt).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <ReviewForm productId={product.id} productSlug={product.slug} />
        </section>

        {related.length > 0 && (
          <section aria-labelledby="relacionados" className="mt-20 border-t border-line pt-16">
            <h2 id="relacionados" className="mb-8 font-display text-3xl font-extrabold tracking-tight">
              También te puede flipar
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
