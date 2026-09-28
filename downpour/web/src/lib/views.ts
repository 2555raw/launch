/* Read-outs the pages share: every coin joined with its currency, priced, with
 * what its pool holds, 24h numbers and a sparkline, all derived from one snapshot. */
import { useMemo } from 'react';
import { parseUnits } from 'viem';
import { usePad } from '../backend/PadProvider';
import type { Coin, Currency, Snapshot, Trade } from '../backend/types';
import { CURRENCY_BY_CODE, currencyColor } from '../data/currencies';
import { priceOf, soldShare, startPriceOf, toUsd } from './math';

export interface CoinRow {
  coin: Coin;
  /** The currency the coin is paid in: the desk token its pool holds. */
  cur: Currency;
  /** The currency it is shown in: `cur`, or the one its creator named, at today's rate. */
  disp: Currency;
  /** Units of `disp` per unit of `cur`. */
  factor: number;
  price: number;
  priceUsd: number;
  mcap: number;
  mcapUsd: number;
  dispPrice: number;
  dispMcap: number;
  dispVol24: number;
  /** The launch price, in `cur`. */
  startPrice: number;
  /** Price now over the launch price. */
  sinceLaunch: number;
  /** Currency in the coin's pool, in whole units of `cur`, and in `disp`. */
  pooled: number;
  pooledUsd: number;
  dispPooled: number;
  /** Share of the supply out of the pool, 0..1. */
  sold: number;
  vol24: number;
  vol24Usd: number;
  change24: number;
  spark: number[];
  trades: number;
  lastTrade: number;
}

const DAY = 86400;

/** Whole units per 1 USD, as a float. */
export function unitsPerUsd(c: Currency) {
  return Number(c.rate) / 1e18;
}

export function amount(value: bigint, decimals = 18) {
  return Number(value) / 10 ** decimals;
}

/** The currency a coin is shown in: its own, or the one its creator named (meta.priced),
 *  as a currency object built on that one's rate: the desk's if it lists it, else today's
 *  from the public feeds (`fx`, units per USD), else the reference rate on file. */
export function displayCurrency(cur: Currency, code: string | undefined, listedByCode: Map<string, Currency>, fx: Record<string, number>): Currency {
  if (!code || code === cur.code) return cur;
  const paidIn = cur.tokenSymbol ?? cur.code;
  const onDesk = listedByCode.get(code);
  if (onDesk) return { ...onDesk, paidIn };
  const s = CURRENCY_BY_CODE[code];
  const rate = fx[code] ?? s?.rate;
  if (!s || !rate) return cur;
  return {
    ...cur,
    code,
    name: s.name,
    symbol: s.symbol,
    region: s.region,
    kind: s.kind,
    color: currencyColor(code),
    rate: parseUnits(rate.toFixed(18), 18),
    tokenSymbol: undefined,
    paidIn,
  };
}

export type DisplayOf = (coin: Coin, cur: Currency) => Currency;

export function buildRows(snap: Snapshot, now: number, displayOf: DisplayOf = (_, cur) => cur): CoinRow[] {
  const curBy = new Map(snap.currencies.map((c) => [c.token.toLowerCase(), c]));
  const byCoin = new Map<string, Trade[]>();
  for (const t of snap.trades) {
    const k = t.coin.toLowerCase();
    let list = byCoin.get(k);
    if (!list) byCoin.set(k, (list = []));
    list.push(t);
  }
  const rows: CoinRow[] = [];
  for (const coin of snap.coins) {
    const cur = curBy.get(coin.currency.toLowerCase());
    if (!cur) continue;
    const trades = byCoin.get(coin.address.toLowerCase()) ?? [];
    const d = cur.decimals;
    const price = priceOf(coin, d);
    const perUsd = unitsPerUsd(cur);
    const tradePrice = (t: Trade) => priceOf({ reserveQuote: t.reserveQuote, reserveToken: t.reserveToken }, d);
    const startPrice = startPriceOf(coin, d);

    let vol24 = 0;
    for (const t of trades) {
      if (now - t.timestamp <= DAY) vol24 += amount(t.quoteAmount, d);
    }
    const before = trades.filter((t) => now - t.timestamp > DAY);
    const ref = before.length ? tradePrice(before[before.length - 1]) : startPrice;
    const change24 = ref ? price / ref - 1 : 0;

    const tail = trades.slice(-48).map(tradePrice);
    const spark = tail.length ? [trades.length > 48 ? tail[0] : startPrice, ...tail, price] : [startPrice, price];
    const disp = displayOf(coin, cur);
    const factor = disp === cur ? 1 : unitsPerUsd(disp) / perUsd;
    const pooled = amount(coin.realQuote, d);

    rows.push({
      coin,
      cur,
      disp,
      factor,
      price,
      priceUsd: price / perUsd,
      mcap: price * 1e9,
      mcapUsd: (price * 1e9) / perUsd,
      dispPrice: price * factor,
      dispMcap: price * 1e9 * factor,
      dispVol24: vol24 * factor,
      startPrice,
      sinceLaunch: startPrice ? price / startPrice : 1,
      pooled,
      pooledUsd: pooled / perUsd,
      dispPooled: pooled * factor,
      sold: soldShare(coin),
      vol24,
      vol24Usd: vol24 / perUsd,
      change24,
      spark,
      trades: trades.length,
      lastTrade: trades.length ? trades[trades.length - 1].timestamp : coin.createdAt,
    });
  }
  return rows;
}

export function useRows(): CoinRow[] {
  const { snap, displayOf } = usePad();
  return useMemo(() => (snap ? buildRows(snap, Date.now() / 1000 + snap.clockSkew, displayOf) : []), [snap, displayOf]);
}

/** Total traded, in USD, across every market (from the markets' own volume counters). */
export function totalVolumeUsd(snap: Snapshot): number {
  const curBy = new Map(snap.currencies.map((c) => [c.token.toLowerCase(), c]));
  let sum = 0;
  for (const coin of snap.coins) {
    const c = curBy.get(coin.currency.toLowerCase());
    if (c) sum += Number(toUsd(c, coin.volume)) / 1e18;
  }
  return sum;
}

/** Currency sitting in every coin's pool, in USD. */
export function totalPooledUsd(snap: Snapshot): number {
  const curBy = new Map(snap.currencies.map((c) => [c.token.toLowerCase(), c]));
  let sum = 0;
  for (const coin of snap.coins) {
    const c = curBy.get(coin.currency.toLowerCase());
    if (c) sum += Number(toUsd(c, coin.realQuote)) / 1e18;
  }
  return sum;
}

export type SortKey = 'new' | 'mcap' | 'volume' | 'change' | 'active';

export function sortRows(rows: CoinRow[], key: SortKey) {
  const s = rows.slice();
  switch (key) {
    case 'new':
      return s.sort((a, b) => b.coin.createdAt - a.coin.createdAt);
    case 'mcap':
      return s.sort((a, b) => b.mcapUsd - a.mcapUsd);
    case 'volume':
      return s.sort((a, b) => b.vol24Usd - a.vol24Usd);
    case 'change':
      return s.sort((a, b) => b.change24 - a.change24);
    case 'active':
      return s.sort((a, b) => b.lastTrade - a.lastTrade);
  }
}
