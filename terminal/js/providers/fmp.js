/* Financial Modeling Prep adapter. */
import { getJSON } from '../http.js';
import { config } from '../config.js';
import { emptyQuote, emptyProfile, emptyFundamentals, n, pctFrom, str } from './model.js';
import { NA } from '../format.js';

const BASE = 'https://financialmodelingprep.com/api';
const key = () => encodeURIComponent(config.apiKey);
const one = (x) => (Array.isArray(x) ? x[0] : x) || {};

export const id = 'fmp';
export const label = 'Financial Modeling Prep';
export const site = 'https://site.financialmodelingprep.com/developer/docs';

/** FMP uses its own symbols for anything that is not a plain equity. */
function symbolFor(asset) {
  if (asset.type === 'crypto') return `${asset.id}USD`;
  if (asset.type === 'fx') return asset.id;
  return asset.ticker;
}

export async function quote(asset) {
  const d = one(await getJSON(`${BASE}/v3/quote/${encodeURIComponent(symbolFor(asset))}?apikey=${key()}`, { provider: label }));
  const q = emptyQuote();
  Object.assign(q, {
    price: n(d.price), change: n(d.change), changePct: n(d.changesPercentage),
    open: n(d.open), prevClose: n(d.previousClose), dayHigh: n(d.dayHigh), dayLow: n(d.dayLow),
    yearHigh: n(d.yearHigh), yearLow: n(d.yearLow), volume: n(d.volume), avgVolume: n(d.avgVolume),
    marketCap: n(d.marketCap), at: d.timestamp ? new Date(d.timestamp * 1000) : new Date(),
  });
  return q;
}

export async function profile(asset) {
  const d = one(await getJSON(`${BASE}/v3/profile/${encodeURIComponent(symbolFor(asset))}?apikey=${key()}`, { provider: label, ttlMinutes: 720 }));
  const p = emptyProfile();
  Object.assign(p, {
    description: str(d.description), ceo: str(d.ceo), employees: n(d.fullTimeEmployees),
    country: str(d.country), sector: str(d.sector), industry: str(d.industry),
    website: str(d.website), exchange: str(d.exchangeShortName), currency: str(d.currency),
    ipoDate: str(d.ipoDate),
  });
  return p;
}

export async function fundamentals(asset) {
  const sym = encodeURIComponent(symbolFor(asset));
  const [ratios, metrics, income] = await Promise.allSettled([
    getJSON(`${BASE}/v3/ratios-ttm/${sym}?apikey=${key()}`, { provider: label, ttlMinutes: 240 }),
    getJSON(`${BASE}/v3/key-metrics-ttm/${sym}?apikey=${key()}`, { provider: label, ttlMinutes: 240 }),
    getJSON(`${BASE}/v3/income-statement/${sym}?limit=2&apikey=${key()}`, { provider: label, ttlMinutes: 720 }),
  ]);
  const r = ratios.status === 'fulfilled' ? one(ratios.value) : {};
  const m = metrics.status === 'fulfilled' ? one(metrics.value) : {};
  const inc = income.status === 'fulfilled' && Array.isArray(income.value) ? income.value : [];
  const cur = inc[0] || {}, prev = inc[1] || {};

  const f = emptyFundamentals();
  Object.assign(f, {
    revenue: n(cur.revenue), ebitda: n(cur.ebitda), ebit: n(cur.operatingIncome),
    netIncome: n(cur.netIncome), eps: n(r.epsTTM ?? cur.eps),
    pe: n(r.peRatioTTM), ps: n(r.priceToSalesRatioTTM), pb: n(r.priceToBookRatioTTM),
    roe: pctFrom(r.returnOnEquityTTM), roic: pctFrom(m.roicTTM),
    grossMargin: pctFrom(r.grossProfitMarginTTM), operatingMargin: pctFrom(r.operatingProfitMarginTTM),
    netMargin: pctFrom(r.netProfitMarginTTM), dividendYield: pctFrom(r.dividendYielTTM ?? r.dividendYieldTTM),
    debt: n(m.totalDebtTTM ?? m.debtToEquityTTM === undefined ? undefined : m.totalDebtTTM),
    cash: n(m.cashPerShareTTM) === NA ? NA : NA,      // per share is not the same figure: leave unavailable
    freeCashFlow: n(m.freeCashFlowPerShareTTM) === NA ? NA : NA,
  });
  if (n(cur.revenue) !== NA && n(prev.revenue) !== NA && prev.revenue) {
    f.revenueGrowth = ((cur.revenue - prev.revenue) / Math.abs(prev.revenue)) * 100;
  }
  if (n(cur.eps) !== NA && n(prev.eps) !== NA && prev.eps) {
    f.epsGrowth = ((cur.eps - prev.eps) / Math.abs(prev.eps)) * 100;
  }
  return f;
}

export async function history(asset, days) {
  const sym = encodeURIComponent(symbolFor(asset));
  const to = new Date(), from = new Date(Date.now() - days * 864e5);
  const iso = (d) => d.toISOString().slice(0, 10);
  const d = await getJSON(`${BASE}/v3/historical-price-full/${sym}?from=${iso(from)}&to=${iso(to)}&apikey=${key()}`, { provider: label, ttlMinutes: 30 });
  const rows = Array.isArray(d?.historical) ? d.historical : [];
  return rows.map(r => ({ t: new Date(r.date), o: n(r.open), h: n(r.high), l: n(r.low), c: n(r.close), v: n(r.volume) }))
             .filter(r => r.c !== NA).reverse();
}

export async function news(asset, limit = 8) {
  const d = await getJSON(`${BASE}/v3/stock_news?tickers=${encodeURIComponent(asset.ticker)}&limit=${limit}&apikey=${key()}`, { provider: label, ttlMinutes: 20 });
  return (Array.isArray(d) ? d : []).map(x => ({
    title: str(x.title), source: str(x.site), url: str(x.url),
    at: x.publishedDate ? new Date(x.publishedDate) : null, image: str(x.image), summary: str(x.text),
  }));
}

export async function peers(asset) {
  const d = await getJSON(`${BASE}/v4/stock_peers?symbol=${encodeURIComponent(asset.ticker)}&apikey=${key()}`, { provider: label, ttlMinutes: 1440 });
  return one(d).peersList || [];
}
