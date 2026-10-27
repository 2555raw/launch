import { describe, expect, it } from 'vitest'
import { demoProducts } from '@/data/demo-catalog'
import { ALLERGEN_CODES, sortAllergens } from '@/lib/allergens'
import { createDemoCatalog } from '@/lib/catalog/demo-repository'
import { mapRecipe } from '@/lib/catalog/mappers'
import { parseCatalogParams } from '@/lib/catalog/params'
import { ageFrom, signUpSchema } from '@/lib/validation/schemas'

const signUp = (birthDate: string, extra: Record<string, unknown> = {}) =>
  signUpSchema.safeParse({ fullName: 'Ana', email: 'ana@example.com', password: 'contraseña-larga', birthDate, acceptPrivacy: true, ...extra })

describe('alérgenos', () => {
  it('son los 14 del Reglamento UE 1169/2011 y se ordenan siempre igual', () => {
    expect(ALLERGEN_CODES).toHaveLength(14)
    expect(sortAllergens(['sesamo', 'gluten', 'inventado'])).toEqual(['gluten', 'sesamo'])
  })

  it('el filtro «sin» oculta kits con el alérgeno, también en trazas', async () => {
    const f = parseCatalogParams({ sin: 'gluten,falso' })
    expect(f.excludeAllergens).toEqual(['gluten'])
    const { items } = await createDemoCatalog().listProducts({ excludeAllergens: ['gluten'] })
    expect(items.length).toBeGreaterThan(0)
    // Tacos: no contiene gluten pero puede tener trazas -> debe quedar fuera
    expect(items.map((p) => p.slug)).not.toContain('kit-tacos-al-pastor')
    expect(items.every((p) => !p.allergens.includes('gluten'))).toBe(true)
  })
})

describe('modelo seco / fresco', () => {
  it('niveles 1 y 2 son 100 % secos y el nivel 3 incluye frescos', () => {
    for (const p of demoProducts) {
      if (p.category === 'primer-bocado' || p.category === 'con-ganas') expect(p.attributes.storage).toBe('seco')
      if (p.category === 'hambre-de-mas') expect(p.attributes.storage).toBe('fresco')
    }
  })
  it('todos los kits tienen receta paso a paso', () => {
    for (const p of demoProducts) expect(p.recipe.steps.length).toBeGreaterThanOrEqual(3)
  })
  it('mapRecipe descarta pasos incompletos', () => {
    expect(mapRecipe({ steps: [{ title: 'A', text: 'b' }, { title: '', text: 'x' }], youAdd: ['agua'] })).toEqual({
      youAdd: ['agua'],
      steps: [{ title: 'A', text: 'b' }],
      tips: [],
    })
    expect(mapRecipe(null)).toEqual({ youAdd: [], steps: [], tips: [] })
  })
})

describe('registro', () => {
  it('calcula la edad en años cumplidos', () => {
    expect(ageFrom('2012-10-28', new Date(2026, 9, 27))).toBe(13)
    expect(ageFrom('2012-10-27', new Date(2026, 9, 27))).toBe(14)
  })
  it('con menos de 14 años exige el permiso de un adulto', () => {
    const young = new Date().getFullYear() - 12
    expect(signUp(`${young}-01-01`).success).toBe(false)
    expect(signUp(`${young}-01-01`, { guardianConsent: true }).success).toBe(true)
  })
  it('rechaza fechas imposibles o edades por debajo del mínimo', () => {
    expect(signUp(`${new Date().getFullYear() - 5}-01-01`, { guardianConsent: true }).success).toBe(false)
    expect(signUp('1800-01-01').success).toBe(false)
  })
  it('acepta alérgenos válidos e ignora el resto', () => {
    expect(signUp('2000-01-01', { avoidAllergens: ['gluten'] }).data?.avoidAllergens).toEqual(['gluten'])
    expect(signUp('2000-01-01', { avoidAllergens: ['veneno'] }).success).toBe(false)
  })
})
