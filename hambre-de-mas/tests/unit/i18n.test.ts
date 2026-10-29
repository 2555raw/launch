import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { demoCategories, demoProducts } from '@/data/demo-catalog'
import { demoCategoriesEn, demoProductsEn } from '@/data/demo-catalog-en'
import { createDemoCatalog } from '@/lib/catalog/demo-repository'
import { localizeCategory, localizeProductDetail, localizeVariantForQuote } from '@/lib/catalog/localize'
import { negotiateLocale, translator } from '@/lib/i18n/config'
import { formatPrice } from '@/lib/money'
import { evaluatePromotion } from '@/lib/pricing/quote'
import { VALIDATION_EN } from '@/lib/validation/messages-en'
import { firstError, signInSchema } from '@/lib/validation/schemas'

describe('idioma', () => {
  it('elige inglés solo si el navegador lo prefiere al español', () => {
    expect(negotiateLocale('en-GB,en;q=0.9,es;q=0.8')).toBe('en')
    expect(negotiateLocale('es-ES,es;q=0.9,en;q=0.8')).toBe('es')
    expect(negotiateLocale('fr-FR,fr;q=0.9,en;q=0.7')).toBe('en')
    expect(negotiateLocale('de-DE')).toBe('es')
    expect(negotiateLocale('en;q=0.2,es;q=0.9')).toBe('es')
    expect(negotiateLocale(null)).toBe('es')
  })

  it('t() devuelve el texto del idioma pedido', () => {
    expect(translator('en')({ es: 'Cesta', en: 'Bag' })).toBe('Bag')
    expect(translator('es')({ es: 'Cesta', en: 'Bag' })).toBe('Cesta')
  })

  it('formatea precios en euros según el idioma', () => {
    expect(formatPrice(3500, 'es')).toMatch(/35,00\s€/)
    expect(formatPrice(3500, 'en')).toBe('€35.00')
  })
})

describe('catálogo traducido', () => {
  it('todos los kits y categorías de demo tienen traducción al inglés completa', () => {
    for (const c of demoCategories) expect(demoCategoriesEn[c.slug]?.name, c.slug).toBeTruthy()
    for (const p of demoProducts) {
      const en = demoProductsEn[p.slug]
      expect(en, p.slug).toBeDefined()
      expect(en?.includes, p.slug).toHaveLength(p.includes.length)
      expect(en?.specs, p.slug).toHaveLength(p.specs.length)
      expect(en?.recipe?.steps, p.slug).toHaveLength(p.recipe.steps.length)
      expect(en?.recipe?.youAdd, p.slug).toHaveLength(p.recipe.youAdd.length)
      expect(en?.imageAlts, p.slug).toHaveLength(p.images.length)
      for (const v of p.variants) expect(en?.variants?.[v.sku], `${p.slug} ${v.sku}`).toBeTruthy()
      if (p.badge) expect(en?.badge, p.slug).toBeTruthy()
    }
  })

  it('aplica la traducción y no manda el campo translations al navegador', async () => {
    const ramen = (await createDemoCatalog().getProduct('kit-ramen-casero'))!
    const en = localizeProductDetail(ramen, 'en')
    expect(en.name).toBe('Homemade ramen kit')
    expect(en.variants[0]?.name).toBe('Serves 2')
    expect(en.recipe.steps[0]?.title).toBe('Soak the mushrooms')
    expect(en.category?.name).toBe('Getting hungry')
    expect(en.image?.alt).toMatch(/miso ramen/)
    expect('translations' in en).toBe(false)
    expect('translations' in (en.category ?? {})).toBe(false)
    // Lo que no depende del idioma no cambia
    expect(en.priceCents).toBe(ramen.priceCents)
    expect(en.allergens).toEqual(ramen.allergens)
    // En español se queda igual
    expect(localizeProductDetail(ramen, 'es').name).toBe('Kit Ramen casero')
  })

  it('si falta una traducción, se queda el texto en español', () => {
    const category = { name: 'Nivel X', tagline: 'Algo', description: null, translations: { en: { name: '' } } }
    expect(localizeCategory(category, 'en')).toEqual({ name: 'Nivel X', tagline: 'Algo', description: null })
  })

  it('el presupuesto del carrito usa los nombres traducidos', async () => {
    const catalog = createDemoCatalog()
    const ramen = (await catalog.getProduct('kit-ramen-casero'))!
    const [variant] = await catalog.getVariantsForQuote([ramen.variants[0]!.id])
    const en = localizeVariantForQuote(variant!, 'en')
    expect(en.productName).toBe('Homemade ramen kit')
    expect(en.variantName).toBe('Serves 2')
  })

  it('la búsqueda encuentra kits por su nombre en inglés', async () => {
    const { items } = await createDemoCatalog().listProducts({ q: 'pancakes' })
    expect(items.map((p) => p.slug)).toEqual(['kit-tortitas-americanas'])
  })
})

describe('mensajes', () => {
  it('todos los mensajes de validación que ve un cliente tienen versión en inglés', () => {
    const source = readFileSync('src/lib/validation/schemas.ts', 'utf8')
    const customerPart = source.slice(0, source.indexOf('// Panel de administración'))
    const literals = [...customerPart.matchAll(/error: '([^']+)'|message: '([^']+)'/g)].map((m) => m[1] ?? m[2]!)
    expect(literals.length).toBeGreaterThan(10)
    for (const message of literals) expect(VALIDATION_EN[message], message).toBeTruthy()
  })

  it('traduce los errores de validación al idioma del cliente', () => {
    const parsed = signInSchema.safeParse({ email: 'no-es-un-email', password: '' })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(firstError(parsed.error, 'es')).toBe('Escribe un email válido')
      expect(firstError(parsed.error, 'en')).toBe('Enter a valid email')
    }
  })

  it('los avisos de códigos promocionales salen en inglés', () => {
    const now = new Date('2026-10-27T10:00:00Z')
    const r = evaluatePromotion(null, 'NADA', 5000, now, 'en')
    expect(r.message).toBe("This code doesn't exist or is no longer active.")
  })
})
