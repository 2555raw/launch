/* How a swap travels, computed the same way Router.quote does it on chain:
 *   currency -> currency   desk
 *   currency -> coin       (desk into the coin's currency) + the coin's market
 *   coin -> currency       the coin's market + (desk out of its currency)
 *   coin -> coin           market, (desk), market
 * Each step is returned so the Swap page can draw the route. */
import type { Address, Coin, Currency, Params } from '../backend/types';
import { quoteBuy, quoteConvert, quoteSell } from './math';

export type StepKind = 'desk' | 'buy' | 'sell';

export interface Step {
  kind: StepKind;
  from: string;
  to: string;
  amountIn: bigint;
  amountOut: bigint;
  fee: bigint;
  snipeTax?: bigint;
  graduates?: boolean;
  /** Price impact on a market step, 0..1. */
  impact?: number;
}

export interface SwapQuote {
  amountOut: bigint;
  refund: bigint;
  /** Currency the refund comes back in (the coin's currency). */
  refundToken?: Address;
  steps: Step[];
  impact: number;
  error?: string;
}

export interface Book {
  currencyByToken: Map<string, Currency>;
  coinByAddress: Map<string, Coin>;
  params: Params;
  now: number;
}

export function makeBook(currencies: Currency[], coins: Coin[], params: Params, now: number): Book {
  return {
    currencyByToken: new Map(currencies.map((c) => [c.token.toLowerCase(), c])),
    coinByAddress: new Map(coins.map((c) => [c.address.toLowerCase(), c])),
    params,
    now,
  };
}

export function tokenLabel(book: Book, token: string) {
  const c = book.currencyByToken.get(token.toLowerCase());
  if (c) return c.code;
  return book.coinByAddress.get(token.toLowerCase())?.symbol ?? '?';
}

function impactOf(before: number, after: number) {
  if (!before) return 0;
  return Math.abs(after - before) / before;
}

function spot(m: { reserveQuote: bigint; reserveToken: bigint }) {
  return Number(m.reserveQuote) / Number(m.reserveToken);
}

export function quoteSwap(book: Book, tokenIn: Address, tokenOut: Address, amountIn: bigint): SwapQuote {
  const empty: SwapQuote = { amountOut: 0n, refund: 0n, steps: [], impact: 0 };
  if (!tokenIn || !tokenOut || amountIn <= 0n) return empty;
  if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) return { ...empty, error: 'Pick two different tokens' };
  const p = book.params;
  const curIn = book.currencyByToken.get(tokenIn.toLowerCase());
  const curOut = book.currencyByToken.get(tokenOut.toLowerCase());
  const coinIn = book.coinByAddress.get(tokenIn.toLowerCase());
  const coinOut = book.coinByAddress.get(tokenOut.toLowerCase());
  if (!curIn && !coinIn) return { ...empty, error: 'Unknown token' };
  if (!curOut && !coinOut) return { ...empty, error: 'Unknown token' };

  const steps: Step[] = [];
  const desk = (from: Currency, to: Currency, amt: bigint) => {
    const q = quoteConvert(from, to, amt, p.deskFeeBps);
    steps.push({ kind: 'desk', from: from.code, to: to.code, amountIn: amt, amountOut: q.amountOut, fee: q.fee });
    return q.amountOut;
  };
  const buy = (coin: Coin, cur: Currency, amt: bigint) => {
    const q = quoteBuy(coin, amt, p, book.now);
    const before = spot(coin);
    const afterReserveQuote = coin.reserveQuote + q.net;
    const afterReserveToken = coin.reserveToken - q.tokensOut;
    steps.push({
      kind: 'buy',
      from: cur.code,
      to: coin.symbol,
      amountIn: q.quoteUsed,
      amountOut: q.tokensOut,
      fee: q.protocolFee + q.creatorFee,
      snipeTax: q.snipeTax,
      graduates: q.graduates,
      impact: afterReserveToken > 0n ? impactOf(before, Number(afterReserveQuote) / Number(afterReserveToken)) : 1,
    });
    return { out: q.tokensOut, refund: amt - q.quoteUsed };
  };
  const sell = (coin: Coin, cur: Currency, amt: bigint) => {
    const q = quoteSell(coin, amt, p);
    const before = spot(coin);
    steps.push({
      kind: 'sell',
      from: coin.symbol,
      to: cur.code,
      amountIn: amt,
      amountOut: q.quoteOut,
      fee: q.protocolFee + q.creatorFee,
      impact: impactOf(before, Number(coin.reserveQuote - q.gross) / Number(coin.reserveToken + amt)),
    });
    return q.quoteOut;
  };
  const currencyOfCoin = (coin: Coin) => book.currencyByToken.get(coin.currency.toLowerCase());

  try {
    let amountOut = 0n;
    let refund = 0n;
    let refundToken: Address | undefined;
    if (curIn && curOut) {
      amountOut = desk(curIn, curOut, amountIn);
    } else if (curIn && coinOut) {
      const cur = currencyOfCoin(coinOut)!;
      const spend = curIn.token === cur.token ? amountIn : desk(curIn, cur, amountIn);
      const r = buy(coinOut, cur, spend);
      amountOut = r.out;
      refund = r.refund;
      refundToken = cur.token;
    } else if (coinIn && curOut) {
      const cur = currencyOfCoin(coinIn)!;
      const got = sell(coinIn, cur, amountIn);
      amountOut = cur.token === curOut.token ? got : desk(cur, curOut, got);
    } else if (coinIn && coinOut) {
      const a = currencyOfCoin(coinIn)!;
      const b = currencyOfCoin(coinOut)!;
      let got = sell(coinIn, a, amountIn);
      if (a.token !== b.token) got = desk(a, b, got);
      const r = buy(coinOut, b, got);
      amountOut = r.out;
      refund = r.refund;
      refundToken = b.token;
    }
    const impact = Math.max(0, ...steps.map((s) => s.impact ?? 0));
    return { amountOut, refund, refundToken, steps, impact };
  } catch {
    return { ...empty, error: 'Could not price this route' };
  }
}
