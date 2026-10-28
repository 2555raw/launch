import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { demoProducts } from '@/data/demo-catalog'
import { ingredientPhoto } from '@/lib/catalog/ingredient-photos'

describe('fotos de «Qué trae el kit»', () => {
  it('cada ingrediente de los kits de demo tiene su foto y el fichero existe', () => {
    for (const p of demoProducts) {
      if (p.slug === 'caja-sorpresa') continue
      for (const item of p.includes) {
        if (/tarjeta/i.test(item)) continue
        const photo = ingredientPhoto(item)
        expect(photo, `${p.slug}: ${item}`).toBeTruthy()
        expect(existsSync(`public${photo}`), `${p.slug}: ${photo}`).toBe(true)
      }
    }
  })

  it('elige la foto concreta antes que la genérica', () => {
    expect(ingredientPhoto('Cebolleta liofilizada')).toBe('/demo/ingredients/cebolleta.jpg')
    expect(ingredientPhoto('Frutos rojos liofilizados')).toBe('/demo/ingredients/frutos-rojos.jpg')
    expect(ingredientPhoto('Guacamole liofilizado')).toBe('/demo/ingredients/guacamole.jpg')
    expect(ingredientPhoto('Verduras crujientes liofilizadas')).toBe('/demo/ingredients/verduras-secas.jpg')
    expect(ingredientPhoto('Aceite de chile y sésamo')).toBe('/demo/ingredients/aceite-chile.jpg')
    expect(ingredientPhoto('Salsa de piña y chile')).toBe('/demo/ingredients/pina.jpg')
    expect(ingredientPhoto('Col, zanahoria, pimiento y cebolla frescos')).toBe('/demo/ingredients/verduras-frescas.jpg')
    expect(ingredientPhoto('Tarjeta de receta con QR')).toBeNull()
  })
})
