import { NextResponse, type NextRequest } from 'next/server'
import { serverEnv } from '@/lib/env'
import { createOrdersService } from '@/lib/orders/service'
import { isServiceRoleConfigured } from '@/lib/supabase/service'

/**
 * Libera el stock de pedidos pendientes que han caducado. Red de seguridad
 * por si se pierde algún webhook checkout.session.expired. Llámalo cada
 * 15-30 minutos (Vercel Cron, GitHub Actions, pg_cron…) con la cabecera
 * Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  const secret = serverEnv.cronSecret()
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!isServiceRoleConfigured()) return NextResponse.json({ error: 'Supabase no está configurado' }, { status: 503 })
  const released = await createOrdersService().expireStale()
  return NextResponse.json({ released })
}
