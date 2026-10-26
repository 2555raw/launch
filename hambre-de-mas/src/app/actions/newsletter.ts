'use server'

import { NEWSLETTER_CONSENT } from '@/lib/config/consent'
import { createOrdersService } from '@/lib/orders/service'
import { isServiceRoleConfigured } from '@/lib/supabase/service'
import { firstError, newsletterSchema } from '@/lib/validation/schemas'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { headers } from 'next/headers'

export type NewsletterState = { ok: boolean; message: string } | null

export async function subscribeNewsletter(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const ip = clientIp(await headers())
  if (!rateLimit(`newsletter:${ip}`, 5, 60_000)) {
    return { ok: false, message: 'Demasiados intentos. Prueba en un minuto.' }
  }
  const parsed = newsletterSchema.safeParse({
    email: formData.get('email'),
    consent: formData.get('consent') === 'on',
  })
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) }
  if (!isServiceRoleConfigured()) {
    return { ok: false, message: 'La newsletter se activará cuando la tienda esté conectada a la base de datos.' }
  }
  await createOrdersService().subscribeNewsletter(parsed.data.email, NEWSLETTER_CONSENT)
  return { ok: true, message: '¡Hecho! Te escribiremos cuando haya kits nuevos.' }
}
