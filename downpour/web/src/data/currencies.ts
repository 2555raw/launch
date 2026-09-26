import list from '@shared/currencies.json';

export type CurrencyKind = 'fiat' | 'metal' | 'crypto';

export interface CurrencyStatic {
  code: string;
  name: string;
  symbol: string;
  region: string;
  kind: CurrencyKind;
  /** Reference units per 1 USD (the playground's starting rate). */
  rate: number;
}

export const CURRENCIES = list as CurrencyStatic[];
export const CURRENCY_BY_CODE: Record<string, CurrencyStatic> = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));

export const REGIONS = ['Americas', 'Europe', 'Middle East', 'Africa', 'Asia', 'Oceania', 'Metals & crypto'];

/** Hand-picked tints for the currencies people will see most; everything else
 *  gets a stable hue from its code. */
const TINTS: Record<string, string> = {
  USD: '#4fd1a1',
  EUR: '#5b8cff',
  GBP: '#b57bff',
  JPY: '#ff6f91',
  CNY: '#ff5a5a',
  INR: '#ff9f43',
  BRL: '#3ddc84',
  MXN: '#ff7a59',
  KRW: '#7c83ff',
  NGN: '#22c55e',
  TRY: '#f43f5e',
  CHF: '#ef4444',
  CAD: '#f87171',
  AUD: '#fbbf24',
  ZAR: '#f59e0b',
  VND: '#e879f9',
  ARS: '#60a5fa',
  XAU: '#facc15',
  XAG: '#cbd5e1',
  XPT: '#a5b4fc',
  BTC: '#f7931a',
  ETH: '#8b9dff',
};

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function currencyColor(code: string): string {
  if (TINTS[code]) return TINTS[code];
  const h = hash(code) % 360;
  return `hsl(${h} 78% 62%)`;
}

/** The glyph drawn inside a drop: short symbols as they are, long ones cut down. */
export function dropGlyph(code: string): string {
  const c = CURRENCY_BY_CODE[code];
  if (!c) return code.slice(0, 2);
  const s = c.symbol;
  return [...s].length <= 3 ? s : code;
}

/** Currencies to feature first (hero drops, launch default, desk top row). */
export const POPULAR = ['USD', 'EUR', 'JPY', 'GBP', 'BRL', 'MXN', 'INR', 'KRW', 'NGN', 'TRY', 'CHF', 'ZAR', 'VND', 'CAD', 'AUD', 'XAU'];

/** Plural nouns for the hero's rotating line. */
export const HERO_WORDS: Array<[string, string]> = [
  ['pesos', 'MXN'],
  ['yen', 'JPY'],
  ['euros', 'EUR'],
  ['rupees', 'INR'],
  ['reais', 'BRL'],
  ['won', 'KRW'],
  ['naira', 'NGN'],
  ['lira', 'TRY'],
  ['rand', 'ZAR'],
  ['francs', 'CHF'],
  ['dollars', 'USD'],
  ['ounces of gold', 'XAU'],
];
