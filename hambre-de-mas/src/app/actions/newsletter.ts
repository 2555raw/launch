'use server'

import { NEWSLETTER_CONSENT } from '@/lib/config/consent'
import { getI18n } from '@/lib/i18n/server'
import { createOrdersService } from '@/lib/orders/service'
import { isServiceRoleConfigured } from '@/lib/supabase/service'
import { firstError, newsletterSchema } from '@/lib/validation/schemas'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { headers } from 'next/headers'

export type NewsletterState = { ok: boolean; message: string } | null

export async function subscribeNewsletter(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const ip = clientIp(await headers())
  const { locale, t } = await getI18n()
  if (!rateLimit(`newsletter:${ip}`, 5, 60_000)) {
    return { ok: false, message: t({ es: 'Demasiados intentos. Prueba en un minuto.', en: 'Too many attempts. Try again in a minute.' }) }
  }
  const parsed = newsletterSchema.safeParse({
    email: formData.get('email'),
    consent: formData.get('consent') === 'on',
  })
  if (!parsed.success) return { ok: false, message: firstError(parsed.error, locale) }
  if (!isServiceRoleConfigured()) {
    return {
      ok: false,
      message: t({
        es: 'La newsletter se activará cuando la tienda esté conectada a la base de datos.',
        en: 'The newsletter will be enabled once the shop is connected to the database.',
      }),
    }
  }
  await createOrdersService().subscribeNewsletter(parsed.data.email, NEWSLETTER_CONSENT)
  return { ok: true, message: t({ es: '¡Hecho! Te escribiremos cuando haya kits nuevos.', en: "Done! We'll write when there are new kits." }) }
}
