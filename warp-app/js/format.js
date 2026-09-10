/* Formatting. One sentinel for "no data", so that in no screen can it be
   confused with a zero. */

export const NA = Symbol('no data');
export const isNA = (v) => v === NA || v === null || v === undefined
  || (typeof v === 'number' && !Number.isFinite(v));
export const NA_TEXT = 'No data';

const nf = (min, max) => new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });

export function num(v, d = 2) {
  if (isNA(v)) return NA_TEXT;
  return nf(d, d).format(v);
}
/** Decimals by magnitude: an index at 104.32 and a coin at 0.0842 need
 *  different precision to say the same thing. */
export function auto(v) {
  if (isNA(v)) return NA_TEXT;
  const a = Math.abs(v);
  // An exact zero is written short: "0.000000" reads as precision that isn't
  // there, not as a zero.
  const d = a === 0 ? 2 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  return nf(d, d).format(v);
}
export function usdg(v, { sign = false } = {}) {
  if (isNA(v)) return NA_TEXT;
  const s = auto(Math.abs(v));
  const mark = v < 0 ? '-' : sign && v > 0 ? '+' : '';
  return `${mark}${s} USDG`;
}
export function compact(v) {
  if (isNA(v)) return NA_TEXT;
  const a = Math.abs(v);
  const unit = (n, u) => `${nf(a / n >= 100 ? 0 : 1, a / n >= 100 ? 0 : 1).format(v / n)}${u}`;
  if (a >= 1e9) return unit(1e9, 'B');
  if (a >= 1e6) return unit(1e6, 'M');
  if (a >= 1e3) return unit(1e3, 'K');
  return nf(0, 0).format(v);
}
export function pct(v, { sign = true, d = 2 } = {}) {
  if (isNA(v)) return NA_TEXT;
  return `${sign && v > 0 ? '+' : ''}${nf(d, d).format(v)}%`;
}
export function lev(v) { return isNA(v) ? NA_TEXT : `${nf(0, 2).format(v)}x`; }

export function ago(ts) {
  if (!ts) return NA_TEXT;
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? 'day' : 'days'} ago`;
}
export function dateTime(ts) {
  if (!ts) return NA_TEXT;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
}
export function clock(ts = Date.now()) {
  return new Intl.DateTimeFormat('en-US', { timeStyle: 'medium', hour12: false }).format(new Date(ts));
}
export const dir = (v) => isNA(v) || v === 0 ? 'flat' : v > 0 ? 'up' : 'down';
