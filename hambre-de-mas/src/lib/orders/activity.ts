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

/** Provincia por los dos primeros dígitos del código postal. */
const PROVINCES: Record<string, string> = {
  '01': 'Álava', '02': 'Albacete', '03': 'Alicante',
  '04': 'Almería', '05': 'Ávila', '06': 'Badajoz',
  '07': 'Baleares', '08': 'Barcelona', '09': 'Burgos',
  '10': 'Cáceres', '11': 'Cádiz', '12': 'Castellón',
  '13': 'Ciudad Real', '14': 'Córdoba', '15': 'A Coruña',
  '16': 'Cuenca', '17': 'Girona', '18': 'Granada',
  '19': 'Guadalajara', '20': 'Gipuzkoa', '21': 'Huelva',
  '22': 'Huesca', '23': 'Jaén', '24': 'León',
  '25': 'Lleida', '26': 'La Rioja', '27': 'Lugo',
  '28': 'Madrid', '29': 'Málaga', '30': 'Murcia',
  '31': 'Navarra', '32': 'Ourense', '33': 'Asturias',
  '34': 'Palencia', '36': 'Pontevedra', '37': 'Salamanca',
  '39': 'Cantabria', '40': 'Segovia', '41': 'Sevilla',
  '42': 'Soria', '43': 'Tarragona', '44': 'Teruel',
  '45': 'Toledo', '46': 'Valencia', '47': 'Valladolid',
  '48': 'Bizkaia', '49': 'Zamora', '50': 'Zaragoza',
}

export function provinceFromPostalCode(postalCode: unknown) {
  return typeof postalCode === 'string' ? (PROVINCES[postalCode.trim().slice(0, 2)] ?? null) : null
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
