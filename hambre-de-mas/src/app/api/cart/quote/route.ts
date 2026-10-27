import { NextResponse, type NextRequest } from 'next/server'
import { getI18n } from '@/lib/i18n/server'
import { quoteCart } from '@/lib/pricing/server-quote'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { cartRequestSchema, firstError } from '@/lib/validation/schemas'

/** Presupuesto del carrito con precios, stock y promociones del servidor. */
export async function POST(request: NextRequest) {
  const { locale, t } = await getI18n()
  if (!rateLimit(`quote:${clientIp(request.headers)}`, 120, 60_000)) {
    return NextResponse.json({ error: t({ es: 'Demasiadas peticiones', en: 'Too many requests' }) }, { status: 429 })
  }
  const body = await request.json().catch(() => null)
  const parsed = cartRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error, locale) }, { status: 400 })
  const quote = await quoteCart(parsed.data.items, parsed.data.promoCode)
  return NextResponse.json({ quote }, { headers: { 'Cache-Control': 'no-store' } })
}
