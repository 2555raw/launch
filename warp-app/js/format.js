/* Formato. Un solo centinela para "sin dato", asi que en ninguna pantalla puede
   confundirse con un cero. */

export const NA = Symbol('sin dato');
export const isNA = (v) => v === NA || v === null || v === undefined
  || (typeof v === 'number' && !Number.isFinite(v));
export const NA_TEXT = 'Sin dato';

const nf = (min, max) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: min, maximumFractionDigits: max });

export function num(v, d = 2) {
  if (isNA(v)) return NA_TEXT;
  return nf(d, d).format(v);
}
/** Decimales segun magnitud: un indice a 104,32 y una cripto a 0,0842 piden
 *  precisiones distintas para decir lo mismo. */
export function auto(v) {
  if (isNA(v)) return NA_TEXT;
  const a = Math.abs(v);
  // El cero exacto se escribe corto: "0,000000" se lee como una precision que
  // no hay, no como un cero.
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
  const unit = (n, u) => `${nf(a / n >= 100 ? 0 : 1, a / n >= 100 ? 0 : 1).format(v / n)} ${u}`;
  if (a >= 1e9) return unit(1e9, 'mm');
  if (a >= 1e6) return unit(1e6, 'M');
  if (a >= 1e3) return unit(1e3, 'mil');
  return nf(0, 0).format(v);
}
export function pct(v, { sign = true, d = 2 } = {}) {
  if (isNA(v)) return NA_TEXT;
  return `${sign && v > 0 ? '+' : ''}${nf(d, d).format(v)} %`;
}
export function lev(v) { return isNA(v) ? NA_TEXT : `${nf(0, 2).format(v)}x`; }

export function ago(ts) {
  if (!ts) return NA_TEXT;
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}
export function dateTime(ts) {
  if (!ts) return NA_TEXT;
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
}
export function clock(ts = Date.now()) {
  return new Intl.DateTimeFormat('es-ES', { timeStyle: 'medium' }).format(new Date(ts));
}
export const dir = (v) => isNA(v) || v === 0 ? 'flat' : v > 0 ? 'up' : 'down';
