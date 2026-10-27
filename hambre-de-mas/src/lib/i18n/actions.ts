'use server'

import { cookies } from 'next/headers'
import { isLocale, LOCALE_COOKIE } from './config'

/** Cambia el idioma. Al guardar la cookie, Next vuelve a pintar la página. */
export async function setLocale(formData: FormData) {
  const locale = formData.get('locale')
  if (!isLocale(locale)) return
  ;(await cookies()).set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
}
