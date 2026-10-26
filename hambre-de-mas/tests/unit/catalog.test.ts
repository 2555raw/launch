import { describe, expect, it } from 'vitest'
import { demoId, demoProducts } from '@/data/demo-catalog'
import { createDemoCatalog } from '@/lib/catalog/demo-repository'
import { normalizeSearch } from '@/lib/catalog/mappers'
import { parseCatalogParams } from '@/lib/catalog/params'
import { signOrderId, verifyOrderToken } from '@/lib/orders/token'

describe('demoId', () => {
  it('es determinista y un UUID v4 válido', () => {
    expect(demoId('product', 'a')).toBe(demoId('product', 'a'))
    expect(demoId('product', 'a')).not.toBe(demoId('variant', 'a'))
    expect(demoId('x', 'y')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it('no repite ids en el catálogo de demo', () => {
    const ids = demoProducts.flatMap((p) => [demoId('product', p.slug), ...p.variants.map((v) => demoId('variant', v.sku))])
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('catálogo de demostración', () => {
  const catalog = createDemoCatalog()

  it('filtra por dieta, precio y categoría', async () => {
    const vegan = await catalog.listProducts({ tags: ['vegano'] })
    expect(vegan.items.length).toBeGreaterThan(0)
    expect(vegan.items.every((p) => p.tags.includes('vegano'))).toBe(true)

    const cheap = await catalog.listProducts({ maxPrice: 1500 })
    expect(cheap.items.every((p) => p.priceCents <= 1500)).toBe(true)

    const level1 = await catalog.listProducts({ category: 'primer-bocado' })
    expect(level1.items.every((p) => p.category?.slug === 'primer-bocado')).toBe(true)
  })

  it('ordena por precio y busca sin tildes', async () => {
    const asc = await catalog.listProducts({ sort: 'price-asc' })
    const prices = asc.items.map((p) => p.priceCents)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    const search = await catalog.listProducts({ q: 'arcoiris' })
    expect(search.items.map((p) => p.slug)).toContain('kit-bowl-arcoiris')
  })

  it('devuelve los datos de variante que necesita el carrito', async () => {
    const product = await catalog.getProduct('kit-ramen-casero')
    const variants = await catalog.getVariantsForQuote(product!.variants.map((v) => v.id))
    expect(variants).toHaveLength(2)
    expect(variants[0]).toMatchObject({ productSlug: 'kit-ramen-casero', productPublished: true })
  })
})

describe('parámetros de la URL del catálogo', () => {
  it('traduce la URL en castellano a filtros', () => {
    const f = parseCatalogParams({ orden: 'precio-desc', dieta: 'vegano,inventada', min: '10', max: '25,5', tiempo: '30', dificultad: '1,9', stock: '1', pagina: '2' })
    expect(f).toMatchObject({ sort: 'price-desc', tags: ['vegano'], minPrice: 1000, maxPrice: 2550, maxMinutes: 30, difficulty: [1], inStock: true, page: 2, offset: 24 })
  })
  it('normaliza búsquedas', () => {
    expect(normalizeSearch('  Pizza NAPOLITANA, ¡ya! ')).toEqual(['pizza', 'napolitana', 'ya'])
    expect(normalizeSearch("'; drop table--")).toEqual(['drop', 'table--'])
  })
})

describe('token de pedido', () => {
  it('solo valida la firma del propio pedido', () => {
    process.env.ORDER_TOKEN_SECRET = 'secreto-de-prueba'
    const token = signOrderId('pedido-1')
    expect(verifyOrderToken('pedido-1', token)).toBe(true)
    expect(verifyOrderToken('pedido-2', token)).toBe(false)
    expect(verifyOrderToken('pedido-1', 'falso')).toBe(false)
    expect(verifyOrderToken('pedido-1', null)).toBe(false)
  })
})
