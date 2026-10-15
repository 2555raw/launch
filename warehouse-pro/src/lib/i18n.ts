/**
 * Internacionalización. El español es el idioma base: las claves son los textos en español
 * y los diccionarios zh/en los traducen. Si falta una traducción, se muestra el texto en español.
 */
import { create } from 'zustand'

export type Lang = 'es' | 'zh' | 'en'
export const LANGS: { id: Lang; label: string; locale: string; flag: string }[] = [
  { id: 'es', label: 'Español', locale: 'es-ES', flag: '🇪🇸' },
  { id: 'zh', label: '中文', locale: 'zh-CN', flag: '🇨🇳' },
  { id: 'en', label: 'English', locale: 'en-GB', flag: '🇬🇧' },
]

const dictionaries: Record<Exclude<Lang, 'es'>, Record<string, string>> = { zh: {}, en: {} }
export function registerDictionary(lang: Exclude<Lang, 'es'>, dict: Record<string, string>) {
  Object.assign(dictionaries[lang], dict)
}

const KEY = 'warehouse-pro:lang'
function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(KEY) as Lang | null
    if (stored && LANGS.some((l) => l.id === stored)) return stored
  } catch { /* ignore */ }
  return 'es'
}

let currentLang: Lang = typeof localStorage !== 'undefined' ? initialLang() : 'es'

export const useI18n = create<{ lang: Lang; setLang: (l: Lang) => void }>((set) => ({
  lang: currentLang,
  setLang: (l) => {
    currentLang = l
    try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : l
    set({ lang: l })
  },
}))

export const getLocale = () => LANGS.find((l) => l.id === currentLang)!.locale

/** Traduce un texto en español al idioma activo. Admite interpolación {clave}. */
export function t(text: string, vars?: Record<string, string | number>): string {
  let out = currentLang === 'es' ? text : dictionaries[currentLang][text] ?? text
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
  return out
}
