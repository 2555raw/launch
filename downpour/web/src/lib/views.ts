/* Read-outs the pages share: every coin joined with its currency, priced, with
 * its curve progress, 24h numbers and a sparkline, all derived from one snapshot. */
import { useMemo } from 'react';
import { usePad } from '../backend/PadProvider';
import type { Coin, Currency, Snapshot, Trade } from '../backend/types';
import { curveRaise, priceOf, progress, toUsd, VIRTUAL_TOKENS } from './math';

export interface CoinRow {
  coin: Coin;
  cur: Currency;
  price: number;
  priceUsd: number;
  mcap: number;
  mcapUsd: number;
  progress: number;
  raised: number;
  raiseTarget: number;
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

export function buildRows(snap: Snapshot, now: number): CoinRow[] {
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
    const startPrice = priceOf({ reserveQuote: coin.virtualQuote, reserveToken: VIRTUAL_TOKENS }, d);

    let vol24 = 0;
    let price24: number | undefined;
    for (const t of trades) {
      if (now - t.timestamp <= DAY) {
        vol24 += amount(t.quoteAmount, d);
        if (price24 === undefined) price24 = tradePrice(t);
      }
    }
    const before = trades.filter((t) => now - t.timestamp > DAY);
    const ref = before.length ? tradePrice(before[before.length - 1]) : startPrice;
    const change24 = ref ? price / ref - 1 : 0;

    const tail = trades.slice(-48).map(tradePrice);
    const spark = tail.length ? [trades.length > 48 ? tail[0] : startPrice, ...tail, price] : [startPrice, price];

    rows.push({
      coin,
      cur,
      price,
      priceUsd: price / perUsd,
      mcap: price * 1e9,
      mcapUsd: (price * 1e9) / perUsd,
      progress: progress(coin),
      raised: amount(coin.realQuote, d),
      raiseTarget: amount(curveRaise(coin.virtualQuote), d),
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
  const { snap } = usePad();
  return useMemo(() => (snap ? buildRows(snap, Date.now() / 1000 + snap.clockSkew) : []), [snap]);
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

export type SortKey = 'new' | 'mcap' | 'volume' | 'progress' | 'active';

export function sortRows(rows: CoinRow[], key: SortKey) {
  const s = rows.slice();
  switch (key) {
    case 'new':
      return s.sort((a, b) => b.coin.createdAt - a.coin.createdAt);
    case 'mcap':
      return s.sort((a, b) => b.mcapUsd - a.mcapUsd);
    case 'volume':
      return s.sort((a, b) => b.vol24Usd - a.vol24Usd);
    case 'progress':
      return s.sort((a, b) => b.progress - a.progress);
    case 'active':
      return s.sort((a, b) => b.lastTrade - a.lastTrade);
  }
}
