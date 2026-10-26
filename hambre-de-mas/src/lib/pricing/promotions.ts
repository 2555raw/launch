import 'server-only'
import { demoId, demoPromotions } from '@/data/demo-catalog'
import { createSupabaseServiceClient, isServiceRoleConfigured } from '@/lib/supabase/service'
import type { Promotion } from '@/lib/types'

/* eslint-disable @typescript-eslint/no-explicit-any -- filas sin tipar de PostgREST */

export function mapPromotion(row: any): Promotion {
  return {
    id: row.id,
    code: row.code,
    description: row.description ?? null,
    kind: row.kind,
    value: row.value,
    minSubtotalCents: row.min_subtotal_cents,
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    maxRedemptions: row.max_redemptions ?? null,
    timesRedeemed: row.times_redeemed ?? 0,
    isActive: row.is_active,
  }
}

/**
 * Busca un código promocional. Las promociones no son legibles desde el
 * navegador (RLS), así que se consultan con la service role en el servidor.
 */
export async function findPromotion(code: string): Promise<Promotion | null> {
  const normalized = code.trim().toUpperCase()
  if (!/^[A-Z0-9_-]{3,32}$/.test(normalized)) return null

  if (!isServiceRoleConfigured()) {
    const demo = demoPromotions.find((p) => p.code === normalized)
    return demo
      ? {
          id: demoId('promotion', demo.code),
          code: demo.code,
          description: demo.description,
          kind: demo.kind,
          value: demo.value,
          minSubtotalCents: demo.minSubtotal,
          startsAt: null,
          endsAt: null,
          maxRedemptions: null,
          timesRedeemed: 0,
          isActive: true,
        }
      : null
  }

  const { data, error } = await createSupabaseServiceClient().from('promotions').select('*').eq('code', normalized).maybeSingle()
  if (error) throw new Error(`[promociones] ${error.message}`)
  return data ? mapPromotion(data) : null
}
