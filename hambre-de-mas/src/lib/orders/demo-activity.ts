import 'server-only'

/**
 * Compras de EJEMPLO para los avisos del prototipo (solo en modo demo, sin
 * base de datos). Con Supabase configurado solo salen compras reales.
 * Se generan igual durante 10 minutos para no repetirse al refrescar.
 */

const PLACES = [
  ...['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Málaga', 'Bilbao', 'Zaragoza', 'Murcia', 'Alicante', 'A Coruña', 'Oviedo', 'Granada', 'Valladolid', 'Pamplona', 'Salamanca', 'Cádiz', 'Santander', 'Toledo'],
  ...['Palma', 'Ibiza', 'Menorca'],
  ...['Las Palmas', 'Santa Cruz de Tenerife'],
  ...['París', 'Lyon', 'Milán', 'Roma', 'Berlín', 'Múnich', 'Lisboa'],
]
// Peso de cada grupo: sobre todo España, algo de islas y un poco de Europa
const WEIGHTS = [...Array(18).fill(6), ...Array(3).fill(3), ...Array(2).fill(3), ...Array(7).fill(1)]

/** Generador pseudoaleatorio con semilla (mulberry32). */
function random(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type DemoPurchase = { key: string; slug: string; place: string; paidAt: string }

export function demoPurchases(slugs: string[], now = Date.now(), count = 10): DemoPurchase[] {
  if (slugs.length === 0) return []
  const bucket = Math.floor(now / 600_000)
  const rand = random(bucket)
  const total = WEIGHTS.reduce((a, b) => a + b, 0)
  const pickPlace = () => {
    let r = rand() * total
    for (let i = 0; i < PLACES.length; i++) {
      r -= WEIGHTS[i]!
      if (r <= 0) return PLACES[i]!
    }
    return PLACES[0]!
  }
  let minutesAgo = 0
  return Array.from({ length: count }, (_, i) => {
    minutesAgo += 1 + Math.floor(rand() * 14)
    return {
      key: `ejemplo-${bucket}-${i}`,
      slug: slugs[Math.floor(rand() * slugs.length)]!,
      place: pickPlace(),
      paidAt: new Date(bucket * 600_000 - minutesAgo * 60_000).toISOString(),
    }
  })
}
