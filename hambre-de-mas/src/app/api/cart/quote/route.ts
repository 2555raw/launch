import { NextResponse, type NextRequest } from 'next/server'
import { quoteCart } from '@/lib/pricing/server-quote'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { cartRequestSchema, firstError } from '@/lib/validation/schemas'

/** Presupuesto del carrito con precios, stock y promociones del servidor. */
export async function POST(request: NextRequest) {
  if (!rateLimit(`quote:${clientIp(request.headers)}`, 120, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas peticiones' }, { status: 429 })
  }
  const body = await request.json().catch(() => null)
  const parsed = cartRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 })
  const quote = await quoteCart(parsed.data.items, parsed.data.promoCode)
  return NextResponse.json({ quote }, { headers: { 'Cache-Control': 'no-store' } })
}
