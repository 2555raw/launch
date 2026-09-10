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
  // Same clock as the header: a listing date must not read in one zone while
  // the market reads in another.
  return new Intl.DateTimeFormat('en-US', {
    timeZone: MARKET_TZ, dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(ts));
}
/* Perpix keeps one clock, and it is New York's.
   A market has a single wall clock, not one per viewer: two people looking at
   the same funding window have to be looking at the same hour. New York is the
   hour the assets themselves keep — most of the registry lists on the NYSE or
   the NASDAQ — so it is the market's time, not a viewer's.

   Naming the zone in Intl means daylight saving is handled by the platform's
   own tz data, which is right twice a year without anyone remembering the
   dates. Changing the market's clock is these two lines and nothing else. */
export const MARKET_TZ = 'America/New_York';
export const MARKET_TZ_LABEL = 'New York';

/* 24-hour, because a trading clock is read in a column next to other figures
   and AM/PM both changes width and leaves noon ambiguous. */
const marketTime = new Intl.DateTimeFormat('en-US', {
  timeZone: MARKET_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
const marketDate = new Intl.DateTimeFormat('en-US', {
  timeZone: MARKET_TZ, weekday: 'short', month: 'short', day: 'numeric',
});
/** The offset New York is on right now, so the clock says which one it is
 *  rather than leaving the reader to guess whether summer time is in force. */
const marketOffset = new Intl.DateTimeFormat('en-US', { timeZone: MARKET_TZ, timeZoneName: 'shortOffset' });

export function clock(ts = Date.now()) { return marketTime.format(new Date(ts)); }
export function marketDay(ts = Date.now()) { return marketDate.format(new Date(ts)); }
export function marketZone(ts = Date.now()) {
  const part = marketOffset.formatToParts(new Date(ts)).find(p => p.type === 'timeZoneName');
  return part ? part.value.replace('GMT', 'UTC') : 'UTC';
}
export const dir = (v) => isNA(v) || v === 0 ? 'flat' : v > 0 ? 'up' : 'down';
