import { INTL_LOCALE, type Locale } from '@/lib/i18n/config'

const euro: Record<Locale, Intl.NumberFormat> = {
  es: new Intl.NumberFormat(INTL_LOCALE.es, { style: 'currency', currency: 'EUR' }),
  en: new Intl.NumberFormat(INTL_LOCALE.en, { style: 'currency', currency: 'EUR' }),
}

/** 1690 -> "16,90 €" (es) · "€16.90" (en) */
export function formatPrice(cents: number, locale: Locale = 'es') {
  return euro[locale].format(cents / 100)
}

/** Fecha corta en el idioma de la página. */
export function formatDate(iso: string, locale: Locale = 'es', options: Intl.DateTimeFormatOptions = { dateStyle: 'long' }) {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], options).format(new Date(iso))
}

export function percentOff(price: number, compareAt: number | null | undefined) {
  if (!compareAt || compareAt <= price) return 0
  return Math.round(((compareAt - price) / compareAt) * 100)
}
