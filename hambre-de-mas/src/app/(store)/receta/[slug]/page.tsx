import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { JsonLd } from '@/components/seo/json-ld'
import { AllergenList } from '@/components/product/allergen-icons'
import { StorageChip } from '@/components/product/storage-chip'
import { buttonClass } from '@/components/ui/button'
import { CheckIcon, ClockIcon, FlameIcon } from '@/components/ui/icons'
import { ProductImage } from '@/components/ui/product-image'
import { RecipePlayer, type PlayerStep } from '@/components/recipe/recipe-player'
import { getCatalog } from '@/lib/catalog'
import { ingredientPhoto } from '@/lib/catalog/ingredient-photos'
import { site } from '@/lib/config/site'
import { getI18n } from '@/lib/i18n/server'
import type { Localized } from '@/lib/i18n/config'
import { formatPrice } from '@/lib/money'

/**
 * Receta paso a paso: es lo que abre el QR de la tarjeta de cada kit.
 * Pensada para el móvil en la cocina: letra grande y pasos que se pueden
 * marcar como hechos (funciona sin JavaScript, con casillas nativas).
 */

export const revalidate = 300

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  try {
    const { products } = await getCatalog().listSitemapEntries()
    return products.map((p) => ({ slug: p.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getCatalog().getProduct((await params).slug)
  const { t } = await getI18n()
  if (!product) return { title: t({ es: 'Receta no encontrada', en: 'Recipe not found' }) }
  return {
    title: t({ es: `Receta: ${dishName(product.name)}`, en: `Recipe: ${dishName(product.name)}` }),
    description: t({
      es: `Paso a paso del ${product.name}. ${product.subtitle ?? ''}`,
      en: `Step by step for the ${product.name}. ${product.subtitle ?? ''}`,
    }),
    alternates: { canonical: `/receta/${product.slug}` },
  }
}

const heatLabel: Record<string, Localized> = {
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

/** «Kit Ramen casero» → «Ramen casero» · «Homemade ramen kit» → «Homemade ramen». */
const dishName = (name: string) => name.replace(/^Kit\s+|\s+kit$/gi, '')
const isCard = (item: string) => /tarjeta|recipe card/i.test(item)

export default async function RecipePage({ params }: Props) {
  const product = await getCatalog().getProduct((await params).slug)
  if (!product || product.recipe.steps.length === 0) notFound()
  const dish = dishName(product.name)
  const { recipe } = product
  const { locale, t } = await getI18n()
  const allAllergens = [...new Set([...product.allergens, ...product.recipeAllergens])]
  // Para el modo vídeo: de fondo las fotos del plato y, en cada paso, la del ingrediente que nombra
  const backgrounds = product.images.map((i) => i.url)
  const playerSteps: PlayerStep[] = recipe.steps.map((s) => ({ ...s, ingredient: ingredientPhoto(`${s.title} ${s.text}`) }))

  return (
    <article className="pb-24">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Recipe',
          name: dish,
          image: product.images.map((i) => (i.url.startsWith('http') ? i.url : `${site.url}${i.url}`)),
          description: product.subtitle ?? product.description,
          totalTime: product.attributes.minutes ? `PT${product.attributes.minutes}M` : undefined,
          recipeIngredient: [...product.includes.filter((i) => !isCard(i)), ...recipe.youAdd],
          recipeInstructions: recipe.steps.map((s) => ({ '@type': 'HowToStep', name: s.title, text: s.text })),
        }}
      />

      {/* Cabecera */}
      <header className="relative overflow-hidden bg-chef-ink text-white">
        <div className="container-page grid items-center gap-8 py-10 sm:py-14 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="pop-word block! text-xs font-bold tracking-[0.18em] text-almendra uppercase">
              {t({ es: 'Receta', en: 'Recipe' })} ·{' '}
              {product.category?.name}
            </p>
            <h1 className="pop-word block! mt-3 font-display text-[40px] leading-[1.03] font-extrabold tracking-tight sm:text-6xl" style={{ '--delay': '0.1s' } as React.CSSProperties}>
              {dish}
            </h1>
            <ul className="pop-word mt-6 flex flex-wrap gap-2 text-[13px]" style={{ '--delay': '0.2s' } as React.CSSProperties}>
              {product.attributes.minutes ? (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
                  <ClockIcon size={15} /> {product.attributes.minutes} min
                </li>
              ) : null}
              {product.attributes.heat && (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5">
                  <FlameIcon size={15} /> {heatLabel[product.attributes.heat] ? t(heatLabel[product.attributes.heat]!) : product.attributes.heat}
                </li>
              )}
              {product.attributes.difficulty ? (
                <li className="rounded-full bg-white/15 px-3 py-1.5">
                  {t({ es: 'Dificultad', en: 'Difficulty' })}: {t(difficultyLabel[product.attributes.difficulty] ?? difficultyLabel[0]!)}
                </li>
              ) : null}
              <li>
                <StorageChip storage={product.attributes.storage} />
              </li>
            </ul>
            <div className="pop-word mt-7" style={{ '--delay': '0.3s' } as React.CSSProperties}>
              <RecipePlayer dish={dish} steps={playerSteps} backgrounds={backgrounds} productSlug={product.slug} variant="dark" />
            </div>
          </div>
          {product.image && (
            <div className="kit-pop relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-full border-[6px] border-white shadow-float">
              <ProductImage src={product.image.url} alt={product.image.alt || dish} fill priority sizes="340px" className="object-cover" />
              <div className="steam top-[8%] left-[22%] w-[56%]" aria-hidden>
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="container-page mt-12 grid gap-12 lg:grid-cols-[340px_1fr] lg:gap-16">
        {/* Antes de empezar */}
        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-[24px] bg-mist p-6">
            <h2 className="font-display text-xl font-bold">{t({ es: 'En tu kit', en: 'In your kit' })}</h2>
            <ul className="mt-3 space-y-2 text-[15px]">
              {product.includes
                .filter((i) => !isCard(i))
                .map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-chef" aria-hidden />
                    {item}
                  </li>
                ))}
            </ul>
          </section>
          <section className="rounded-[24px] bg-almendra-soft p-6">
            <h2 className="font-display text-xl font-bold">{t({ es: 'Lo que pones tú', en: 'What you add' })}</h2>
            <ul className="mt-3 space-y-2 text-[15px]">
              {recipe.youAdd.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teja" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </section>
          {allAllergens.length > 0 && (
            <section className="rounded-[24px] border border-line p-6">
              <h2 className="mb-4 font-display text-xl font-bold">{t({ es: 'Alérgenos', en: 'Allergens' })}</h2>
              <AllergenList codes={allAllergens} size={40} />
            </section>
          )}
        </aside>

        {/* Pasos */}
        <section aria-labelledby="pasos">
          <h2 id="pasos" className="font-display text-3xl font-extrabold tracking-tight">
            {t({ es: 'Paso a paso', en: 'Step by step' })}
          </h2>
          <p className="mt-1 text-[15px] text-ash-ink">{t({ es: 'Toca cada paso cuando lo termines.', en: 'Tap each step when you finish it.' })}</p>
          <ol className="mt-6 space-y-4">
            {recipe.steps.map((step, i) => (
              <li key={step.title} className="scroll-reveal">
                <label className="group flex cursor-pointer gap-4 rounded-[22px] bg-white p-5 shadow-card ring-1 ring-black/[0.04] transition-[background-color,opacity] has-[:checked]:bg-mist has-[:checked]:opacity-70 sm:p-6">
                  <input type="checkbox" className="peer sr-only" />
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-chef-ink font-display text-xl font-extrabold text-white transition-colors peer-checked:bg-hoja-ink peer-focus-visible:ring-2 peer-focus-visible:ring-chef-ink peer-focus-visible:ring-offset-2">
                    <span className="group-has-[:checked]:hidden">{i + 1}</span>
                    <CheckIcon size={22} strokeWidth={2.6} className="hidden group-has-[:checked]:block" />
                  </span>
                  <span>
                    <span className="block font-display text-lg font-bold group-has-[:checked]:line-through sm:text-xl">{step.title}</span>
                    <span className="mt-1 block text-[16px] leading-relaxed text-ink/85 sm:text-[17px]">{step.text}</span>
                  </span>
                </label>
              </li>
            ))}
          </ol>

          {recipe.tips.length > 0 && (
            <div className="mt-8 rounded-[24px] bg-hoja/15 p-6">
              <h3 className="font-display text-lg font-bold text-hoja-deep">{t({ es: 'Trucos de chef', en: 'Chef tips' })}</h3>
              <ul className="mt-2 space-y-1.5 text-[15px] text-hoja-deep">
                {recipe.tips.map((tip) => (
                  <li key={tip}>· {tip}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-10 flex flex-col items-start gap-4 rounded-[28px] bg-ink p-7 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-2xl font-extrabold">{t({ es: '¿Te ha flipado?', en: 'Loved it?' })}</p>
              <p className="mt-1 text-white/75">
                {t({
                  es: `Repite o sube de nivel. Desde ${formatPrice(product.priceCents)}.`,
                  en: `Cook it again or level up. From ${formatPrice(product.priceCents, locale)}.`,
                })}
              </p>
            </div>
            <Link href={`/producto/${product.slug}`} className={buttonClass('secondary', 'lg', 'btn-sheen !bg-white ring-0')}>
              {t({ es: 'Ver el kit', en: 'See the kit' })}
            </Link>
          </div>
        </section>
      </div>
    </article>
  )
}
