import { describe, expect, it } from 'vitest'
import { provinceFromPostalCode } from '@/lib/orders/activity'

describe('avisos de compras recientes', () => {
  it('solo muestran la provincia, deducida del código postal', () => {
    expect(provinceFromPostalCode('28013')).toBe('Madrid')
    expect(provinceFromPostalCode('07001')).toBe('Baleares')
    expect(provinceFromPostalCode('46002')).toBe('Valencia')
  })
  it('sin código postal válido no se muestra lugar', () => {
    expect(provinceFromPostalCode('35001')).toBeNull()
    expect(provinceFromPostalCode('')).toBeNull()
    expect(provinceFromPostalCode(undefined)).toBeNull()
  })
})
