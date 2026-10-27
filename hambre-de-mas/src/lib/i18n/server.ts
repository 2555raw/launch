import 'server-only'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { isLocale, LOCALE_COOKIE, negotiateLocale, translator, type Locale } from './config'

/**
 * Idioma de la petición actual: la cookie que deja el selector o, la primera
 * vez, el idioma preferido del navegador.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value
  if (isLocale(chosen)) return chosen
  return negotiateLocale((await headers()).get('accept-language'))
})

export async function getI18n() {
  const locale = await getLocale()
  return { locale, t: translator(locale) }
}
