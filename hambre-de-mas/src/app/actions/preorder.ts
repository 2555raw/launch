'use server'

import { headers } from 'next/headers'
import { getCatalog } from '@/lib/catalog'
import { getI18n } from '@/lib/i18n/server'
import { createOrdersService } from '@/lib/orders/service'
import { releaseLabel } from '@/lib/preorder'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { isServiceRoleConfigured } from '@/lib/supabase/service'
import { firstError, preorderSchema } from '@/lib/validation/schemas'

export type PreorderState = { ok: boolean; message: string } | null

/** Encarga una edición que aún no se puede comprar: no se cobra nada, solo se guarda quién la quiere. */
export async function reservePreorder(_prev: PreorderState, formData: FormData): Promise<PreorderState> {
  const ip = clientIp(await headers())
  const { locale, t } = await getI18n()
  if (!rateLimit(`preorder:${ip}`, 5, 60_000)) {
    return { ok: false, message: t({ es: 'Demasiados intentos. Prueba en un minuto.', en: 'Too many attempts. Try again in a minute.' }) }
  }
  const parsed = preorderSchema.safeParse({
    variantId: formData.get('variantId'),
    quantity: formData.get('quantity'),
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    consent: formData.get('consent') === 'on',
  })
  if (!parsed.success) return { ok: false, message: firstError(parsed.error, locale) }

  // El servidor comprueba que de verdad es una edición por encargo
  const [variant] = await getCatalog().getVariantsForQuote([parsed.data.variantId])
  if (!variant?.preorderRelease || !variant.isActive || !variant.productPublished) {
    return { ok: false, message: t({ es: 'Este kit no se puede encargar.', en: "This kit can't be pre-ordered." }) }
  }

  // Sin base de datos (vista previa) no hay dónde guardarlo, pero el recorrido es el mismo
  if (isServiceRoleConfigured()) {
    await createOrdersService().savePreorder({
      productId: variant.productId,
      variantId: variant.variantId,
      quantity: parsed.data.quantity,
      name: parsed.data.fullName,
      email: parsed.data.email,
      locale,
    })
  }
  const day = releaseLabel(variant.preorderRelease, locale)
  return {
    ok: true,
    message: t({
      es: `¡Encargada! Te guardamos ${parsed.data.quantity === 1 ? 'tu caja' : `tus ${parsed.data.quantity} cajas`}. Sale el ${day}: antes te escribiremos a ${parsed.data.email} para confirmarla.`,
      en: `Pre-ordered! We're keeping ${parsed.data.quantity === 1 ? 'your box' : `your ${parsed.data.quantity} boxes`} for you. It comes out on ${day}: we'll email ${parsed.data.email} to confirm it first.`,
    }),
  }
}
