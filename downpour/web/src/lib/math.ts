/* The pad's arithmetic, mirrored from Launchpad.sol / CurrencyDesk.sol with the
 * same integer rounding. The playground runs on it, and live mode uses it for
 * instant previews before asking the chain.
 *
 * A coin's market is its Uniswap V3 pool: the whole supply in one position from the
 * launch price to the top of the scale. Inside that range the pool is a constant-product
 * curve on virtual reserves (x · y = k), which is what these functions compute; the
 * pool's 1% fee comes off the input and never enters the reserves. */

export const WAD = 10n ** 18n;
export const BPS = 10_000n;
export const TOTAL_SUPPLY = 1_000_000_000n * WAD;
/** Fee units of a Uniswap pool: hundredths of a bip. */
export const PIPS = 1_000_000n;
/** The pools' fee tier, 1%; half of it is the creator's. */
export const POOL_FEE_PIPS = 10_000;

export interface MarketState {
  createdAt: number;
  /** What the whole supply was worth at launch, in currency units. */
  startQuote: bigint;
  /** Virtual reserves: coins and currency, whose ratio is the price. For a position that runs
   *  to the top of the scale the coin side is also what the pool really holds. */
  reserveToken: bigint;
  reserveQuote: bigint;
  /** Currency the pool really holds (buys in, sells out, fees until collected). */
  realQuote: bigint;
  /** Currency traded through the pad, gross. */
  volume: bigint;
}

export interface FeeParams {
  /** The pool fee in hundredths of a bip (10000 = 1%). */
  poolFeePips: number;
}

export interface CurrencyRate {
  decimals: number;
  /** Units per 1 USD, 18-decimal fixed point. */
  rate: bigint;
}

export const mulDiv = (a: bigint, b: bigint, d: bigint) => (a * b) / d;
export const mulDivUp = (a: bigint, b: bigint, d: bigint) => (a * b + d - 1n) / d;

export interface BuyQuote {
  tokensOut: bigint;
  quoteUsed: bigint;
  /** What enters the reserves: the input less the pool fee. */
  net: bigint;
  /** The pool fee, in currency: half the creator's, half the protocol's. */
  fee: bigint;
  creatorFee: bigint;
  protocolFee: bigint;
}

/** What `quoteIn` of currency buys: the fee comes off the input, the rest moves along x · y = k. */
export function quoteBuy(m: MarketState, quoteIn: bigint, p: FeeParams): BuyQuote {
  const net = (quoteIn * (PIPS - BigInt(p.poolFeePips))) / PIPS;
  const tokensOut = m.reserveQuote + net === 0n ? 0n : mulDiv(m.reserveToken, net, m.reserveQuote + net);
  const fee = quoteIn - net;
  const creatorFee = fee / 2n;
  return { tokensOut, quoteUsed: quoteIn, net, fee, creatorFee, protocolFee: fee - creatorFee };
}

export interface SellQuote {
  /** What the coins would fetch with no fee. */
  gross: bigint;
  quoteOut: bigint;
  /** The pool fee in currency terms (it is really taken in coins: `feeTokens`). */
  fee: bigint;
  feeTokens: bigint;
  creatorFee: bigint;
  protocolFee: bigint;
}

/** What `tokensIn` coins sell for: the fee comes off the coins going in. */
export function quoteSell(m: MarketState, tokensIn: bigint, p: FeeParams): SellQuote {
  const net = (tokensIn * (PIPS - BigInt(p.poolFeePips))) / PIPS;
  const quoteOut = m.reserveToken + net === 0n ? 0n : mulDiv(m.reserveQuote, net, m.reserveToken + net);
  const gross = m.reserveToken + tokensIn === 0n ? 0n : mulDiv(m.reserveQuote, tokensIn, m.reserveToken + tokensIn);
  const fee = gross > quoteOut ? gross - quoteOut : 0n;
  const creatorFee = fee / 2n;
  return { gross, quoteOut, fee, feeTokens: tokensIn - net, creatorFee, protocolFee: fee - creatorFee };
}

/** State after a buy: the net input joins the reserves, the whole input lands in the pool. */
export function applyBuy(m: MarketState, q: BuyQuote): MarketState {
  const next = { ...m };
  next.reserveToken -= q.tokensOut;
  next.reserveQuote += q.net;
  next.realQuote += q.quoteUsed;
  next.volume += q.quoteUsed;
  return next;
}

/** State after a sell: the net coins join the reserves (the fee coins sit in the pool for
 *  the creator and the protocol), the currency leaves. */
export function applySell(m: MarketState, tokensIn: bigint, q: SellQuote): MarketState {
  const next = { ...m };
  next.reserveToken += tokensIn - q.feeTokens;
  next.reserveQuote -= q.quoteOut;
  next.realQuote -= q.quoteOut;
  next.volume += q.quoteOut;
  return next;
}

/** A market at launch: the whole supply against the start quote, nothing real in the pool yet. */
export function newMarket(startQuote: bigint, createdAt: number): MarketState {
  return { createdAt, startQuote, reserveToken: TOTAL_SUPPLY, reserveQuote: startQuote, realQuote: 0n, volume: 0n };
}

/* ---------------------------- currency desk ---------------------------- */

const pow10 = (d: number) => 10n ** BigInt(d);

export function quoteConvert(from: CurrencyRate, to: CurrencyRate, amountIn: bigint, deskFeeBps: number) {
  const gross = mulDiv(amountIn, to.rate * pow10(to.decimals), from.rate * pow10(from.decimals));
  const fee = (gross * BigInt(deskFeeBps)) / BPS;
  return { amountOut: gross - fee, fee };
}

/** USD value, 18 decimals. */
export function toUsd(c: CurrencyRate, amount: bigint): bigint {
  return mulDiv(amount, WAD * WAD, c.rate * pow10(c.decimals));
}

export function fromUsd(c: CurrencyRate, usdWad: bigint): bigint {
  return mulDiv(usdWad, c.rate * pow10(c.decimals), WAD * WAD);
}

/** What a whole supply is worth at launch in a currency, as the pad computes it. */
export function startQuoteFor(c: CurrencyRate, startMcapUsd: bigint): bigint {
  return fromUsd(c, startMcapUsd);
}

/* ------------------------------ read-outs ------------------------------ */

/** Price of one whole coin in whole units of its currency. */
export function priceOf(m: Pick<MarketState, 'reserveQuote' | 'reserveToken'>, quoteDecimals = 18): number {
  if (m.reserveToken === 0n) return 0;
  const scaled = (m.reserveQuote * WAD * pow10(18 - quoteDecimals)) / m.reserveToken;
  return Number(scaled) / 1e18;
}

export function marketCap(m: Pick<MarketState, 'reserveQuote' | 'reserveToken'>, quoteDecimals = 18): number {
  return priceOf(m, quoteDecimals) * 1e9;
}

/** The launch price, in whole units of the currency per coin. */
export function startPriceOf(m: Pick<MarketState, 'startQuote'>, quoteDecimals = 18): number {
  return priceOf({ reserveQuote: m.startQuote, reserveToken: TOTAL_SUPPLY }, quoteDecimals);
}

/** Coins out of the pool, in wallets: the supply less what the pool holds. */
export function circulating(m: Pick<MarketState, 'reserveToken'>): bigint {
  return m.reserveToken >= TOTAL_SUPPLY ? 0n : TOTAL_SUPPLY - m.reserveToken;
}

/** Share of the supply that has left the pool, 0..1. */
export function soldShare(m: Pick<MarketState, 'reserveToken'>): number {
  return Number((circulating(m) * 1_000_000n) / TOTAL_SUPPLY) / 1_000_000;
}

/** Price now over the launch price. */
export function sinceLaunch(m: Pick<MarketState, 'reserveQuote' | 'reserveToken' | 'startQuote'>): number {
  const start = startPriceOf(m);
  return start ? priceOf(m) / start : 1;
}

/* ------------------------------ Uniswap V3 ------------------------------ */

export const Q96 = 2n ** 96n;

/** The virtual reserves behind a pool's price and liquidity in range. */
export function reservesFromPool(sqrtPriceX96: bigint, liquidity: bigint): { reserveToken: bigint; reserveQuote: bigint } {
  if (sqrtPriceX96 === 0n || liquidity === 0n) return { reserveToken: 0n, reserveQuote: 0n };
  return { reserveToken: (liquidity * Q96) / sqrtPriceX96, reserveQuote: (liquidity * sqrtPriceX96) / Q96 };
}
