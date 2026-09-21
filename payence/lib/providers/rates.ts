import type { ExchangeRateProvider, Quote } from "./types";
import { config } from "@/lib/config";
import { ASSETS, isAssetId, type AssetId, type FiatCurrency } from "@/lib/assets";

/**
 * Rates. Stablecoins are quoted through their peg: USDC->EUR is the USD->EUR
 * rate, because a stablecoin's price against its peg is 1 by construction. The
 * small deviation a real venue would show (0.9995 etc.) is a market data feed,
 * not something to invent.
 */

const FIXED_FX: Record<string, string> = {
  "USD:EUR": "0.92",
  "EUR:USD": "1.0870",
  "USD:USD": "1",
  "EUR:EUR": "1",
};

function pegOf(code: string): string {
  return isAssetId(code) ? ASSETS[code as AssetId].peg : code;
}

/** Development default: ECB-ish constants, clearly marked as such in the UI. */
export class FixedRates implements ExchangeRateProvider {
  readonly name = "fixed";
  async quote(from: string, to: string): Promise<Quote> {
    const rate = FIXED_FX[`${pegOf(from)}:${pegOf(to)}`];
    if (!rate) throw new Error(`No rate for ${from}->${to}`);
    return { from, to, rate, asOf: Date.now(), source: "fixed" };
  }
}

/** Frankfurter publishes the ECB reference rates and needs no API key. */
export class FrankfurterRates implements ExchangeRateProvider {
  readonly name = "frankfurter";
  private cache = new Map<string, Quote>();
  private ttl = 10 * 60_000;

  async quote(from: string, to: string): Promise<Quote> {
    const base = pegOf(from);
    const target = pegOf(to);
    if (base === target) return { from, to, rate: "1", asOf: Date.now(), source: "peg" };
    const key = `${base}:${target}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.asOf < this.ttl) return { ...hit, from, to };
    const res = await fetch(`https://api.frankfurter.app/latest?from=${base}&to=${target}`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) throw new Error(`Rate lookup failed (${res.status})`);
    const json = (await res.json()) as { rates: Record<string, number> };
    const value = json.rates?.[target];
    if (!value) throw new Error(`No rate for ${key}`);
    const quote: Quote = { from, to, rate: value.toFixed(6), asOf: Date.now(), source: "ECB via Frankfurter" };
    this.cache.set(key, quote);
    return quote;
  }
}

let cached: ExchangeRateProvider | null = null;

export function rates(): ExchangeRateProvider {
  if (!cached) cached = config.rates.provider === "frankfurter" ? new FrankfurterRates() : new FixedRates();
  return cached;
}

/**
 * The rate used to show a fiat equivalent next to a stablecoin balance. Falls
 * back to the fixed table if the live provider is unreachable, so a balance
 * screen never fails because a rate feed is down.
 */
export async function fiatRate(assetId: AssetId, currency: FiatCurrency): Promise<Quote> {
  try {
    return await rates().quote(assetId, currency);
  } catch {
    return new FixedRates().quote(assetId, currency);
  }
}
