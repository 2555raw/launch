import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { site } from '@/lib/config/site'
import { startCheckout } from '@/lib/orders/checkout'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { checkoutSchema, fieldErrors, firstError } from '@/lib/validation/schemas'

/**
 * Inicia el pago. El navegador solo envía ids de variante, cantidades y los
 * datos de envío; precios, descuentos y gastos de envío se calculan aquí.
 */
export async function POST(request: NextRequest) {
  if (!rateLimit(`checkout:${clientIp(request.headers)}`, 10, 60_000)) {
    return NextResponse.json({ message: 'Demasiados intentos. Espera un minuto.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: firstError(parsed.error), fields: fieldErrors(parsed.error) }, { status: 400 })
  }

  const user = await getCurrentUser()
  // La URL de vuelta sale de la configuración, no de la cabecera Host.
  const result = await startCheckout(parsed.data, { userId: user?.id ?? null, origin: site.url })

  if (!result.ok) {
    const status = result.code === 'payments_not_configured' ? 503 : result.code === 'payment_error' ? 502 : 409
    return NextResponse.json({ message: result.message, code: result.code, quote: result.quote }, { status })
  }
  return NextResponse.json({ url: result.url, orderId: result.orderId })
}
