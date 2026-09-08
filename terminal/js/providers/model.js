/* The internal shape every provider normalises into. The rest of the app only
   ever sees this, so swapping provider is a file, not a rewrite. Any field a
   provider cannot supply stays NA and the interface says so. */

import { NA } from '../format.js';

export const emptyQuote = () => ({
  price: NA, change: NA, changePct: NA, open: NA, prevClose: NA,
  dayHigh: NA, dayLow: NA, yearHigh: NA, yearLow: NA,
  volume: NA, avgVolume: NA, marketCap: NA, at: null,
});

export const emptyProfile = () => ({
  description: NA, ceo: NA, employees: NA, country: NA, sector: NA,
  industry: NA, website: NA, exchange: NA, currency: NA, ipoDate: NA,
});

export const emptyFundamentals = () => ({
  revenue: NA, ebitda: NA, ebit: NA, netIncome: NA, eps: NA,
  pe: NA, forwardPe: NA, ps: NA, pb: NA, roe: NA, roic: NA,
  grossMargin: NA, operatingMargin: NA, netMargin: NA,
  debt: NA, cash: NA, netDebt: NA, freeCashFlow: NA, dividendYield: NA,
  revenueGrowth: NA, epsGrowth: NA,
});

/** number or NA: providers happily return 0, null, '' and 'None' for missing. */
export const n = (v) => {
  if (v === null || v === undefined || v === '' || v === 'None') return NA;
  const x = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : NA;
};
export const pctFrom = (v) => {   // providers mix 0.23 and 23 for the same idea
  const x = n(v);
  return x === NA ? NA : Math.abs(x) <= 1.5 ? x * 100 : x;
};
export const str = (v) => (v === null || v === undefined || v === '' ? NA : String(v));
