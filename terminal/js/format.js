/* Formatting. NA is a single sentinel so "no data" can never be confused with
   zero anywhere in the interface. */

export const NA = Symbol('sin dato');
export const isNA = (v) => v === NA || v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v));
export const NA_TEXT = 'Datos no disponibles';

const nf = (min, max) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: min, maximumFractionDigits: max });

export function num(v, decimals = 2) {
  if (isNA(v)) return NA_TEXT;
  return nf(decimals, decimals).format(v);
}
export function price(v, currency = 'USD') {
  if (isNA(v)) return NA_TEXT;
  const d = Math.abs(v) >= 1000 ? 2 : Math.abs(v) >= 1 ? 2 : 4;
  const s = nf(d, d).format(v);
  return currency === 'EUR' ? `${s} €` : currency === 'JPY' ? `¥${s}` : `$${s}`;
}
export function pct(v, withSign = true) {
  if (isNA(v)) return NA_TEXT;
  const s = nf(2, 2).format(v);
  return `${withSign && v > 0 ? '+' : ''}${s} %`;
}
export function compact(v, currency = 'USD') {
  if (isNA(v)) return NA_TEXT;
  const abs = Math.abs(v);
  const sym = currency === 'EUR' ? '€' : '$';
  const unit = (n, u) => `${sym}${nf(2, 2).format(v / n)} ${u}`;
  if (abs >= 1e12) return unit(1e12, 'B');   // billones europeos
  if (abs >= 1e9) return unit(1e9, 'mm');
  if (abs >= 1e6) return unit(1e6, 'M');
  if (abs >= 1e3) return unit(1e3, 'mil');
  return `${sym}${nf(2, 2).format(v)}`;
}
export function count(v) {
  if (isNA(v)) return NA_TEXT;
  return new Intl.NumberFormat('es-ES').format(v);
}
export function ratio(v, decimals = 2) {
  if (isNA(v)) return NA_TEXT;
  return nf(decimals, decimals).format(v) + '×';
}
export function dateTime(d) {
  if (!d) return NA_TEXT;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return NA_TEXT;
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(dt);
}
export function dateOnly(d) {
  if (!d) return NA_TEXT;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return NA_TEXT;
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(dt);
}
export const dirClass = (v) => isNA(v) ? 'flat' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
