/* Number, amount, address and time formatting. Amounts on chain are bigints with
 * 18 decimals (or the token's own); everything here turns them into short,
 * human-sized strings. */
import { formatUnits } from 'viem';

export function toNum(value: bigint, decimals = 18): number {
  return Number(formatUnits(value, decimals));
}

const SUFFIXES: Array<[number, string]> = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/** 1234567 -> "1.23M"; small numbers keep enough significant digits to be useful. */
export function compact(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e3) {
    for (const [v, s] of SUFFIXES) {
      if (a >= v) return `${trim((n / v).toFixed(digits))}${s}`;
    }
  }
  if (a >= 1) return trim(n.toFixed(digits));
  return small(n);
}

/** Tiny prices: 0.00001234 keeps four significant digits instead of rounding to 0. */
export function small(n: number, sig = 4): string {
  if (n === 0) return '0';
  const a = Math.abs(n);
  if (a >= 1) return trim(n.toFixed(2));
  const zeros = Math.floor(-Math.log10(a));
  const places = Math.min(zeros + sig, 18);
  return trim(n.toFixed(places));
}

function trim(s: string) {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Plain grouped number with a fixed number of decimals. */
export function grouped(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** An amount of a currency with its symbol: "€1.2K", "¥148,000", "0.0021 Au". */
export function money(n: number, symbol: string, opts: { compact?: boolean } = {}): string {
  const body = opts.compact === false ? smartGrouped(n) : compact(n);
  const joiner = /^[A-Za-z]/.test(symbol.slice(-1)) && symbol.length > 1 ? ' ' : '';
  return n < 0 ? `-${symbol}${joiner}${body.replace('-', '')}` : `${symbol}${joiner}${body}`;
}

function smartGrouped(n: number) {
  const a = Math.abs(n);
  if (a >= 1000) return grouped(n, 0);
  if (a >= 1) return grouped(n, 2);
  return small(n);
}

export function usd(n: number): string {
  return money(n, '$');
}

export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function shortAddr(a?: string, head = 6, tail = 4): string {
  if (!a) return '';
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export function ago(tsSeconds: number, nowSeconds = Date.now() / 1000): string {
  const d = Math.max(0, nowSeconds - tsSeconds);
  if (d < 45) return 'just now';
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
}

/** Parses what someone typed into an amount field into base units, or null. */
export function parseAmount(text: string, decimals = 18): bigint | null {
  const t = text.trim().replace(/,/g, '');
  if (!t || !/^\d*\.?\d*$/.test(t) || t === '.') return null;
  const [whole, frac = ''] = t.split('.');
  const f = (frac + '0'.repeat(decimals)).slice(0, decimals);
  try {
    return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(f || '0');
  } catch {
    return null;
  }
}

/** Base units back into an input-friendly string with at most `maxDp` decimals. */
export function toInput(value: bigint, decimals = 18, maxDp = 6): string {
  const s = formatUnits(value, decimals);
  if (!s.includes('.')) return s;
  const [w, f] = s.split('.');
  const cut = f.slice(0, maxDp).replace(/0+$/, '');
  return cut ? `${w}.${cut}` : w;
}

/** A read-only amount field's text: short enough to fit, still copy-pasteable. */
export function toDisplay(value: bigint, decimals = 18): string {
  const n = toNum(value, decimals);
  if (n === 0) return '0';
  if (n >= 1000) return trim(n.toFixed(2));
  if (n >= 1) return trim(n.toFixed(4));
  return small(n, 6);
}
