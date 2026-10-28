import 'server-only'
import { createHash } from 'node:crypto'
import { createSupabaseServiceClient, isServiceRoleConfigured } from '@/lib/supabase/service'

/**
 * Compras recientes para los avisos de «alguien ha comprado…».
 *
 * Solo salen pedidos PAGADOS de verdad (nunca se inventan) y de forma
 * anónima: el producto y la provincia, deducida del código postal. Sin
 * nombres, ciudades ni importes. Sin Supabase (modo demo) no hay avisos.
 */

export type RecentPurchase = {
  /** Clave opaca para no repetir el aviso; no permite identificar el pedido. */
  key: string
  slug: string | null
  productName: string
  imageUrl: string | null
  province: string | null
  paidAt: string
}

/** Provincia (y coordenadas de su capital) por los dos primeros dígitos del código postal. */
const PROVINCES: Record<string, [name: string, lat: number, lng: number]> = {
  '01': ['Álava', 42.85, -2.67], '02': ['Albacete', 38.99, -1.86], '03': ['Alicante', 38.35, -0.48],
  '04': ['Almería', 36.84, -2.46], '05': ['Ávila', 40.66, -4.7], '06': ['Badajoz', 38.88, -6.97],
  '07': ['Baleares', 39.57, 2.65], '08': ['Barcelona', 41.39, 2.17], '09': ['Burgos', 42.34, -3.7],
  '10': ['Cáceres', 39.47, -6.37], '11': ['Cádiz', 36.53, -6.29], '12': ['Castellón', 39.99, -0.05],
  '13': ['Ciudad Real', 38.98, -3.93], '14': ['Córdoba', 37.89, -4.78], '15': ['A Coruña', 43.36, -8.41],
  '16': ['Cuenca', 40.07, -2.13], '17': ['Girona', 41.98, 2.82], '18': ['Granada', 37.18, -3.6],
  '19': ['Guadalajara', 40.63, -3.17], '20': ['Gipuzkoa', 43.32, -1.98], '21': ['Huelva', 37.26, -6.95],
  '22': ['Huesca', 42.14, -0.41], '23': ['Jaén', 37.78, -3.79], '24': ['León', 42.6, -5.57],
  '25': ['Lleida', 41.62, 0.62], '26': ['La Rioja', 42.47, -2.45], '27': ['Lugo', 43.01, -7.56],
  '28': ['Madrid', 40.42, -3.7], '29': ['Málaga', 36.72, -4.42], '30': ['Murcia', 37.99, -1.13],
  '31': ['Navarra', 42.81, -1.64], '32': ['Ourense', 42.34, -7.86], '33': ['Asturias', 43.36, -5.85],
  '34': ['Palencia', 42.01, -4.53], '36': ['Pontevedra', 42.43, -8.64], '37': ['Salamanca', 40.97, -5.66],
  '39': ['Cantabria', 43.46, -3.8], '40': ['Segovia', 40.95, -4.12], '41': ['Sevilla', 37.39, -5.98],
  '42': ['Soria', 41.76, -2.47], '43': ['Tarragona', 41.12, 1.25], '44': ['Teruel', 40.34, -1.11],
  '45': ['Toledo', 39.86, -4.02], '46': ['Valencia', 39.47, -0.38], '47': ['Valladolid', 41.65, -4.72],
  '48': ['Bizkaia', 43.26, -2.93], '49': ['Zamora', 41.5, -5.75], '50': ['Zaragoza', 41.65, -0.89],
}

const provinceEntry = (postalCode: unknown) =>
  typeof postalCode === 'string' ? (PROVINCES[postalCode.trim().slice(0, 2)] ?? null) : null

export function provinceFromPostalCode(postalCode: unknown) {
  return provinceEntry(postalCode)?.[0] ?? null
}

/** Horas hacia atrás que se miran. */
export const RECENT_PURCHASES_HOURS = 48

type Row = {
  id: string
  paid_at: string
  shipping_address: { postalCode?: unknown } | null
  order_items: { product_name: string; product_slug: string | null; image_url: string | null }[]
}

export async function getRecentPurchases(limit = 12): Promise<RecentPurchase[]> {
  if (!isServiceRoleConfigured()) return []
  const since = new Date(Date.now() - RECENT_PURCHASES_HOURS * 3_600_000).toISOString()
  const { data, error } = await createSupabaseServiceClient()
    .from('orders')
    .select('id, paid_at, shipping_address, order_items(product_name, product_slug, image_url)')
    .eq('status', 'paid')
    .gte('paid_at', since)
    .order('paid_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return (data as Row[]).flatMap((order) => {
    const item = order.order_items[0]
    if (!item) return []
    return [
      {
        key: createHash('sha256').update(order.id).digest('hex').slice(0, 12),
        slug: item.product_slug,
        productName: item.product_name,
        imageUrl: item.image_url,
        province: provinceFromPostalCode(order.shipping_address?.postalCode),
        paidAt: order.paid_at,
      },
    ]
  })
}

export type PurchasePoint = { province: string; lat: number; lng: number; orders: number }

/** Días hacia atrás que cuenta el mapa de pedidos. */
export const PURCHASE_MAP_DAYS = 90

/** Pedidos pagados de los últimos días agrupados por provincia, para el globo de la portada. */
export async function getPurchaseMap(): Promise<PurchasePoint[]> {
  if (!isServiceRoleConfigured()) return []
  const since = new Date(Date.now() - PURCHASE_MAP_DAYS * 86_400_000).toISOString()
  const { data, error } = await createSupabaseServiceClient()
    .from('orders')
    .select('shipping_address')
    .eq('status', 'paid')
    .gte('paid_at', since)
    .limit(5000)
  if (error || !data) return []
  const points = new Map<string, PurchasePoint>()
  for (const order of data as { shipping_address: { postalCode?: unknown } | null }[]) {
    const entry = provinceEntry(order.shipping_address?.postalCode)
    if (!entry) continue
    const [province, lat, lng] = entry
    const point = points.get(province) ?? { province, lat, lng, orders: 0 }
    point.orders += 1
    points.set(province, point)
  }
  return [...points.values()].sort((a, b) => b.orders - a.orders)
}
