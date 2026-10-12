'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ZH } from './zh';

export type Locale = 'en' | 'zh';
export const LOCALES: Array<{ code: Locale; label: string; native: string }> = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'zh', label: 'Chinese', native: '中文' },
];
const STORAGE_KEY = 'launch_locale';

/**
 * Minimal, dependency-free i18n. Source strings are English; `t('Some text')` returns the
 * Chinese translation from the dictionary when the locale is `zh`, otherwise the English text.
 * Placeholders use `{name}` and are filled from the second argument.
 */
export type Dict = Record<string, string>;
export type TFn = (text: string, vars?: Record<string, string | number>) => string;

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFn;
}

const I18nContext = createContext<Ctx>({ locale: 'en', setLocale: () => undefined, t: (s, v) => interpolate(s, v) });

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function translate(locale: Locale, text: string, vars?: Record<string, string | number>): string {
  const dict = locale === 'zh' ? ZH : null;
  const out = dict?.[text] ?? text;
  return interpolate(out, vars);
}

export function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') return stored;
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || '').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  useEffect(() => {
    setLocaleState(detectLocale());
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
      document.cookie = `${STORAGE_KEY}=${l}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      /* ignore */
    }
  }, []);
  const t = useCallback<TFn>((text, vars) => translate(locale, text, vars), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  return useContext(I18nContext);
}

export function useT(): TFn {
  return useContext(I18nContext).t;
}

/** Non-hook access for code outside React (toasts, formatters). Reads the current locale from storage. */
export function tGlobal(text: string, vars?: Record<string, string | number>): string {
  return translate(detectLocale(), text, vars);
}
