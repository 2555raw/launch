import type { Locale } from '@/lib/i18n/config'
import type { Preorder, ProductAttributes } from '@/lib/types'

const DAY = 86_400_000

/** Inicio de un día en hora peninsular (en diciembre, UTC+1). */
const dayStart = (date: string) => new Date(`${date}T00:00:00+01:00`)

/** Momento en que se cierran los encargos: al acabar el último día (o al salir, si no hay último día). */
export const preorderClosesAt = (p: Preorder) => (p.closesDate ? new Date(dayStart(p.closesDate).getTime() + DAY) : dayStart(p.releaseDate))

/** El kit aún no ha salido: no se puede comprar (solo encargar, si los encargos siguen abiertos). */
export function isPreorder(attributes: Pick<ProductAttributes, 'preorder'> | null | undefined, now = new Date()): boolean {
  const date = attributes?.preorder?.releaseDate
  return Boolean(date) && now < dayStart(date!)
}

/** Todavía se puede encargar. */
export function isPreorderOpen(attributes: Pick<ProductAttributes, 'preorder'> | null | undefined, now = new Date()): boolean {
  const p = attributes?.preorder
  return Boolean(p) && isPreorder(attributes, now) && now < preorderClosesAt(p!)
}

/** Días completos que faltan hasta `target` (0 durante el último día). */
export function fullDaysUntil(target: Date, now = new Date()): number {
  return Math.max(0, Math.floor((target.getTime() - now.getTime()) / DAY))
}

/** «25 de diciembre» / «25 December» (con `short`, «25 dic» / «25 Dec»). */
export function dayLabel(date: string, locale: Locale, month: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month, timeZone: 'Europe/Madrid' })
    .format(dayStart(date))
    .replace('.', '')
}
