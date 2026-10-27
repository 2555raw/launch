import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { site } from '@/lib/config/site'
import { getI18n } from '@/lib/i18n/server'
import { startCheckout } from '@/lib/orders/checkout'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { checkoutSchema, fieldErrors, firstError } from '@/lib/validation/schemas'

/**
 * Inicia el pago. El navegador solo envía ids de variante, cantidades y los
 * datos de envío; precios, descuentos y gastos de envío se calculan aquí.
 */
export async function POST(request: NextRequest) {
  const { locale, t } = await getI18n()
  if (!rateLimit(`checkout:${clientIp(request.headers)}`, 10, 60_000)) {
    return NextResponse.json({ message: t({ es: 'Demasiados intentos. Espera un minuto.', en: 'Too many attempts. Please wait a minute.' }) }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: firstError(parsed.error, locale), fields: fieldErrors(parsed.error, locale) }, { status: 400 })
  }

  const user = await getCurrentUser()
  // La URL de vuelta sale de la configuración, no de la cabecera Host.
  const result = await startCheckout(parsed.data, { userId: user?.id ?? null, origin: site.url, locale })

  if (!result.ok) {
    const status = result.code === 'payments_not_configured' ? 503 : result.code === 'payment_error' ? 502 : 409
    return NextResponse.json({ message: result.message, code: result.code, quote: result.quote }, { status })
  }
  return NextResponse.json({ url: result.url, orderId: result.orderId })
}
