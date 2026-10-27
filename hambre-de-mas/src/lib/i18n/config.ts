/**
 * Idiomas de la tienda. El español es el idioma principal (y el de los textos
 * legales); el inglés es una traducción completa de la parte de clientes.
 *
 * Los textos se escriben junto a donde se usan, como pares { es, en }: así
 * TypeScript obliga a dar las dos versiones y no se queda ninguna sin traducir.
 */

export const LOCALES = ['es', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'es'
export const LOCALE_COOKIE = 'hdm_locale'

/** Un texto en todos los idiomas de la tienda. */
export type Localized<T = string> = Record<Locale, T>

export const LOCALE_LABELS: Localized = { es: 'Español', en: 'English' }
/** Para Intl (fechas, números). */
export const INTL_LOCALE: Localized = { es: 'es-ES', en: 'en-GB' }
export const OG_LOCALE: Localized = { es: 'es_ES', en: 'en_GB' }

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/**
 * Elige idioma a partir de la cabecera Accept-Language: inglés solo si el
 * navegador lo prefiere antes que el español.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE
  const ranked = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().toLowerCase().split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      return { lang: tag.split('-')[0] ?? '', q: q ? Number(q.slice(2)) || 0 : 1, index }
    })
    .filter((entry) => entry.lang && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
  const first = ranked.find((entry) => isLocale(entry.lang))
  return first ? (first.lang as Locale) : DEFAULT_LOCALE
}

/** Devuelve la función t(...) para un idioma. */
export function translator(locale: Locale) {
  return function t<T>(text: Localized<T>): T {
    return text[locale]
  }
}

export type Translate = ReturnType<typeof translator>
