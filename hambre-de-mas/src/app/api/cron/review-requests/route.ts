import { NextResponse, type NextRequest } from 'next/server'
import { commerce } from '@/lib/config/commerce'
import { sendReviewRequest } from '@/lib/email/review-request'
import { serverEnv } from '@/lib/env'
import { createOrdersService } from '@/lib/orders/service'
import { isServiceRoleConfigured } from '@/lib/supabase/service'

/**
 * Pide opinión por email a quien ya tiene su pedido: unos días después de
 * marcarlo como entregado (o enviado, si nadie lo marca como entregado).
 * Llámalo una vez al día con Authorization: Bearer <CRON_SECRET>. Cada
 * pedido recibe el email una sola vez; sin proveedor de email no se marca,
 * así que se enviará cuando lo configures.
 */
export async function GET(request: NextRequest) {
  const secret = serverEnv.cronSecret()
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!isServiceRoleConfigured()) return NextResponse.json({ error: 'Supabase no está configurado' }, { status: 503 })
  const orders = createOrdersService()
  const due = await orders.listDueReviewRequests(commerce.reviewRequestAfterDeliveryDays, commerce.reviewRequestAfterShippingDays)
  let sent = 0
  for (const order of due) {
    const result = await sendReviewRequest(order).catch((e) => {
      console.error('[opiniones] email', e)
      return { sent: false as const }
    })
    if (!result.sent) continue
    await orders.markReviewRequested(order.id)
    sent += 1
  }
  return NextResponse.json({ due: due.length, sent })
}
