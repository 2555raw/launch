import type { Locale } from '@/lib/i18n/config'
import type { ProductAttributes } from '@/lib/types'

/** Inicio del día de salida en hora peninsular (en diciembre, UTC+1). */
const releaseStart = (date: string) => new Date(`${date}T00:00:00+01:00`)

/** El kit solo se puede encargar (no comprar) hasta su día de salida. */
export function isPreorder(attributes: Pick<ProductAttributes, 'preorder'> | null | undefined, now = new Date()): boolean {
  const date = attributes?.preorder?.releaseDate
  return Boolean(date) && now < releaseStart(date!)
}

/** Días que faltan para la salida (1 el día antes). */
export function daysUntilRelease(date: string, now = new Date()): number {
  return Math.max(0, Math.ceil((releaseStart(date).getTime() - now.getTime()) / 86_400_000))
}

/** «25 de diciembre» / «25 December» (con `short`, «25 dic» / «25 Dec»). */
export function releaseLabel(date: string, locale: Locale, month: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month, timeZone: 'Europe/Madrid' })
    .format(releaseStart(date))
    .replace('.', '')
}
