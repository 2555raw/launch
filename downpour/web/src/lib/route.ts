/* How a swap travels, computed the same way Router.quote does it on chain:
 *   currency -> currency   desk (or a Uniswap pool, where the desk cannot pay)
 *   currency -> coin       (desk into the coin's currency) + the coin's pool
 *   coin -> currency       the coin's pool + (desk out of its currency)
 *   coin -> coin           pool, (desk), pool
 * Each step is returned so the Swap page can draw the route.
 *
 * Between two real tokens (USDG and WETH on Robinhood Chain) the desk has nothing to
 * pay with, so that leg goes through Uniswap instead: the quote then needs the pool's
 * answer, which only the chain knows. `quoteSwap` says so (`needsExternal`), the page
 * fetches it, and passes it back in as `external`. */
import type { Address, Coin, Currency, ExternalQuote, Params } from '../backend/types';
import { quoteBuy, quoteConvert, quoteSell } from './math';

export type StepKind = 'desk' | 'buy' | 'sell' | 'uniswap';

export interface Step {
  kind: StepKind;
  from: string;
  to: string;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  /** Fee inside the step, in the currency it is paid in (`from` on a buy, `to` otherwise). */
  fee: bigint;
  /** Price impact on a pool step, 0..1. */
  impact?: number;
  /** The Uniswap quote a 'uniswap' step runs on. */
  external?: ExternalQuote;
}

export interface SwapQuote {
  amountOut: bigint;
  steps: Step[];
  impact: number;
  error?: string;
  /** A currency leg the desk cannot pay: fetch the Uniswap price for it and quote again. */
  needsExternal?: { tokenIn: Address; tokenOut: Address; amountIn: bigint };
  /** How many transactions the route takes: one through the router, or one per leg with Uniswap in it. */
  transactions: number;
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

class NeedsExternal extends Error {
  constructor(public leg: { tokenIn: Address; tokenOut: Address; amountIn: bigint }) {
    super('needs a Uniswap quote');
  }
}

export function quoteSwap(book: Book, tokenIn: Address, tokenOut: Address, amountIn: bigint, external?: ExternalQuote | null): SwapQuote {
  const empty: SwapQuote = { amountOut: 0n, steps: [], impact: 0, transactions: 0 };
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
  let reason = '';
  /** Currency to currency: the desk at its posted rate when it can pay (it mints test currencies;
   *  a real token comes out of its reserve), else the Uniswap pool the page was told about. */
  const convert = (from: Currency, to: Currency, amt: bigint) => {
    const q = quoteConvert(from, to, amt, p.deskFeeBps);
    const deskCan = to.reserve === undefined || q.amountOut <= to.reserve;
    if (deskCan) {
      steps.push({ kind: 'desk', from: from.code, to: to.code, tokenIn: from.token, tokenOut: to.token, amountIn: amt, amountOut: q.amountOut, fee: q.fee });
      return q.amountOut;
    }
    const ext = external && external.tokenIn.toLowerCase() === from.token.toLowerCase() && external.tokenOut.toLowerCase() === to.token.toLowerCase() && external.amountIn === amt ? external : null;
    if (ext === null && external === null) {
      reason = `No Uniswap pool for ${from.code}/${to.code} on this chain yet, and the desk holds no ${to.code}`;
      throw new Error(reason);
    }
    if (!ext) throw new NeedsExternal({ tokenIn: from.token, tokenOut: to.token, amountIn: amt });
    steps.push({ kind: 'uniswap', from: from.code, to: to.code, tokenIn: from.token, tokenOut: to.token, amountIn: amt, amountOut: ext.amountOut, fee: 0n, external: ext });
    return ext.amountOut;
  };
  const buy = (coin: Coin, cur: Currency, amt: bigint) => {
    const q = quoteBuy(coin, amt, p);
    const before = spot(coin);
    const afterReserveQuote = coin.reserveQuote + q.net;
    const afterReserveToken = coin.reserveToken - q.tokensOut;
    steps.push({
      kind: 'buy',
      from: cur.code,
      to: coin.symbol,
      tokenIn: cur.token,
      tokenOut: coin.address,
      amountIn: amt,
      amountOut: q.tokensOut,
      fee: q.fee,
      impact: afterReserveToken > 0n ? impactOf(before, Number(afterReserveQuote) / Number(afterReserveToken)) : 1,
    });
    return q.tokensOut;
  };
  const sell = (coin: Coin, cur: Currency, amt: bigint) => {
    const q = quoteSell(coin, amt, p);
    const before = spot(coin);
    steps.push({
      kind: 'sell',
      from: coin.symbol,
      to: cur.code,
      tokenIn: coin.address,
      tokenOut: cur.token,
      amountIn: amt,
      amountOut: q.quoteOut,
      fee: q.fee,
      impact: impactOf(before, Number(coin.reserveQuote - q.quoteOut) / Number(coin.reserveToken + amt - q.feeTokens)),
    });
    return q.quoteOut;
  };
  const currencyOfCoin = (coin: Coin) => book.currencyByToken.get(coin.currency.toLowerCase());

  try {
    let amountOut = 0n;
    if (curIn && curOut) {
      amountOut = convert(curIn, curOut, amountIn);
    } else if (curIn && coinOut) {
      const cur = currencyOfCoin(coinOut)!;
      const spend = curIn.token.toLowerCase() === cur.token.toLowerCase() ? amountIn : convert(curIn, cur, amountIn);
      amountOut = buy(coinOut, cur, spend);
    } else if (coinIn && curOut) {
      const cur = currencyOfCoin(coinIn)!;
      const got = sell(coinIn, cur, amountIn);
      amountOut = cur.token.toLowerCase() === curOut.token.toLowerCase() ? got : convert(cur, curOut, got);
    } else if (coinIn && coinOut) {
      const a = currencyOfCoin(coinIn)!;
      const b = currencyOfCoin(coinOut)!;
      let got = sell(coinIn, a, amountIn);
      if (a.token.toLowerCase() !== b.token.toLowerCase()) got = convert(a, b, got);
      amountOut = buy(coinOut, b, got);
    }
    const impact = Math.max(0, ...steps.map((s) => s.impact ?? 0));
    const viaUniswap = steps.some((s) => s.kind === 'uniswap');
    return { amountOut, steps, impact, transactions: viaUniswap ? steps.length : 1 };
  } catch (e) {
    if (e instanceof NeedsExternal) return { ...empty, needsExternal: e.leg };
    return { ...empty, error: reason || 'Could not price this route' };
  }
}
