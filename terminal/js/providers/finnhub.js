/* Finnhub adapter. Same contract as every other provider. */
import { getJSON } from '../http.js';
import { config } from '../config.js';
import { emptyQuote, emptyProfile, emptyFundamentals, n, pctFrom, str } from './model.js';
import { NA } from '../format.js';

const BASE = 'https://finnhub.io/api/v1';
const key = () => encodeURIComponent(config.apiKey);

export const id = 'finnhub';
export const label = 'Finnhub';
export const site = 'https://finnhub.io/docs/api';

function symbolFor(asset) {
  if (asset.type === 'crypto') return `BINANCE:${asset.id}USDT`;
  if (asset.type === 'fx') return `OANDA:${asset.id.slice(0, 3)}_${asset.id.slice(3)}`;
  return asset.ticker;
}

export async function quote(asset) {
  const d = await getJSON(`${BASE}/quote?symbol=${encodeURIComponent(symbolFor(asset))}&token=${key()}`, { provider: label });
  const q = emptyQuote();
  Object.assign(q, {
    price: n(d.c), change: n(d.d), changePct: n(d.dp), open: n(d.o),
    prevClose: n(d.pc), dayHigh: n(d.h), dayLow: n(d.l),
    at: d.t ? new Date(d.t * 1000) : new Date(),
  });
  return q;
}

export async function profile(asset) {
  const d = await getJSON(`${BASE}/stock/profile2?symbol=${encodeURIComponent(asset.ticker)}&token=${key()}`, { provider: label, ttlMinutes: 720 });
  const p = emptyProfile();
  Object.assign(p, {
    country: str(d.country), industry: str(d.finnhubIndustry), website: str(d.weburl),
    exchange: str(d.exchange), currency: str(d.currency), ipoDate: str(d.ipo),
  });
  return p;
}

export async function fundamentals(asset) {
  const d = await getJSON(`${BASE}/stock/metric?symbol=${encodeURIComponent(asset.ticker)}&metric=all&token=${key()}`, { provider: label, ttlMinutes: 240 });
  const m = d?.metric || {};
  const f = emptyFundamentals();
  Object.assign(f, {
    eps: n(m.epsTTM), pe: n(m.peTTM), ps: n(m.psTTM), pb: n(m.pbAnnual),
    roe: pctFrom(m.roeTTM), roic: pctFrom(m.roiTTM),
    grossMargin: pctFrom(m.grossMarginTTM), operatingMargin: pctFrom(m.operatingMarginTTM),
    netMargin: pctFrom(m.netProfitMarginTTM), dividendYield: pctFrom(m.dividendYieldIndicatedAnnual),
    revenueGrowth: pctFrom(m.revenueGrowthTTMYoy), epsGrowth: pctFrom(m.epsGrowthTTMYoy),
  });
  return f;
}

export async function history(asset, days) {
  const to = Math.floor(Date.now() / 1000), from = to - days * 86400;
  const res = asset.type === 'stock' || asset.type === 'etf' ? 'stock/candle' : 'crypto/candle';
  const d = await getJSON(`${BASE}/${res}?symbol=${encodeURIComponent(symbolFor(asset))}&resolution=D&from=${from}&to=${to}&token=${key()}`, { provider: label, ttlMinutes: 30 });
  if (d?.s !== 'ok' || !Array.isArray(d.t)) return [];
  return d.t.map((t, i) => ({ t: new Date(t * 1000), o: n(d.o[i]), h: n(d.h[i]), l: n(d.l[i]), c: n(d.c[i]), v: n(d.v?.[i]) }))
            .filter(r => r.c !== NA);
}

export async function news(asset, limit = 8) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const to = new Date(), from = new Date(Date.now() - 21 * 864e5);
  const d = await getJSON(`${BASE}/company-news?symbol=${encodeURIComponent(asset.ticker)}&from=${iso(from)}&to=${iso(to)}&token=${key()}`, { provider: label, ttlMinutes: 20 });
  return (Array.isArray(d) ? d : []).slice(0, limit).map(x => ({
    title: str(x.headline), source: str(x.source), url: str(x.url),
    at: x.datetime ? new Date(x.datetime * 1000) : null, image: str(x.image), summary: str(x.summary),
  }));
}

export async function peers(asset) {
  const d = await getJSON(`${BASE}/stock/peers?symbol=${encodeURIComponent(asset.ticker)}&token=${key()}`, { provider: label, ttlMinutes: 1440 });
  return Array.isArray(d) ? d.filter(t => t !== asset.ticker) : [];
}
