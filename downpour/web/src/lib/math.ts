/* The pad's arithmetic, mirrored from Launchpad.sol / CurrencyDesk.sol with the
 * same integer rounding. The playground runs on it, and live mode uses it for
 * instant previews before asking the chain. */

export const WAD = 10n ** 18n;
export const BPS = 10_000n;
export const TOTAL_SUPPLY = 1_000_000_000n * WAD;
export const CURVE_SUPPLY = 800_000_000n * WAD;
export const POOL_SUPPLY = TOTAL_SUPPLY - CURVE_SUPPLY;
export const VIRTUAL_TOKENS = (CURVE_SUPPLY * CURVE_SUPPLY) / (CURVE_SUPPLY - POOL_SUPPLY);
export const VIRTUAL_EXTRA = VIRTUAL_TOKENS - CURVE_SUPPLY;

export interface MarketState {
  createdAt: number;
  graduated: boolean;
  virtualQuote: bigint;
  reserveToken: bigint;
  reserveQuote: bigint;
  realQuote: bigint;
  curveLeft: bigint;
  volume: bigint;
}

export interface FeeParams {
  protocolFeeBps: number;
  creatorFeeBps: number;
  snipeTaxBps: number;
  snipeWindow: number;
}

export interface CurrencyRate {
  decimals: number;
  /** Units per 1 USD, 18-decimal fixed point. */
  rate: bigint;
}

export const mulDiv = (a: bigint, b: bigint, d: bigint) => (a * b) / d;
export const mulDivUp = (a: bigint, b: bigint, d: bigint) => (a * b + d - 1n) / d;

export function snipeBps(createdAt: number, now: number, p: FeeParams): number {
  const elapsed = Math.max(0, Math.floor(now) - createdAt);
  if (elapsed >= p.snipeWindow) return 0;
  return Math.floor((p.snipeTaxBps * (p.snipeWindow - elapsed)) / p.snipeWindow);
}

export interface BuyQuote {
  tokensOut: bigint;
  quoteUsed: bigint;
  net: bigint;
  protocolFee: bigint;
  creatorFee: bigint;
  snipeTax: bigint;
  graduates: boolean;
  snipeBps: number;
}

export function quoteBuy(m: MarketState, quoteIn: bigint, p: FeeParams, now: number, exempt = false): BuyQuote {
  const snipe = exempt ? 0 : snipeBps(m.createdAt, now, p);
  const totalBps = BigInt(p.protocolFeeBps + p.creatorFeeBps + snipe);
  let quoteUsed = quoteIn;
  let net = (quoteIn * (BPS - totalBps)) / BPS;
  let tokensOut = mulDiv(m.reserveToken, net, m.reserveQuote + net);
  let graduates = false;
  if (!m.graduated && tokensOut >= m.curveLeft) {
    tokensOut = m.curveLeft;
    net = mulDivUp(m.reserveQuote, tokensOut, m.reserveToken - tokensOut);
    quoteUsed = mulDivUp(net, BPS, BPS - totalBps);
    if (quoteUsed > quoteIn) quoteUsed = quoteIn;
    graduates = true;
  }
  const fees = quoteUsed - net;
  let snipeTax = 0n;
  let creatorFee = 0n;
  let protocolFee = 0n;
  if (totalBps !== 0n && fees !== 0n) {
    snipeTax = (fees * BigInt(snipe)) / totalBps;
    creatorFee = (fees * BigInt(p.creatorFeeBps)) / totalBps;
    protocolFee = fees - snipeTax - creatorFee;
  }
  return { tokensOut, quoteUsed, net, protocolFee, creatorFee, snipeTax, graduates, snipeBps: snipe };
}

export interface SellQuote {
  gross: bigint;
  quoteOut: bigint;
  protocolFee: bigint;
  creatorFee: bigint;
}

export function quoteSell(m: MarketState, tokensIn: bigint, p: FeeParams): SellQuote {
  let gross = mulDiv(m.reserveQuote, tokensIn, m.reserveToken + tokensIn);
  if (gross > m.realQuote) gross = m.realQuote;
  const feeBps = BigInt(p.protocolFeeBps + p.creatorFeeBps);
  const fees = (gross * feeBps) / BPS;
  let creatorFee = 0n;
  let protocolFee = 0n;
  if (feeBps !== 0n) {
    creatorFee = (fees * BigInt(p.creatorFeeBps)) / feeBps;
    protocolFee = fees - creatorFee;
  }
  return { gross, quoteOut: gross - fees, protocolFee, creatorFee };
}

/** State after a buy, including graduation into the pool. */
export function applyBuy(m: MarketState, q: BuyQuote): MarketState {
  const next = { ...m };
  next.reserveToken -= q.tokensOut;
  next.reserveQuote += q.net;
  next.realQuote += q.net;
  if (!next.graduated) next.curveLeft -= q.tokensOut;
  next.volume += q.quoteUsed;
  if (!next.graduated && next.curveLeft === 0n) {
    next.graduated = true;
    next.reserveToken = POOL_SUPPLY;
    next.reserveQuote = next.realQuote;
  }
  return next;
}

export function applySell(m: MarketState, tokensIn: bigint, q: SellQuote): MarketState {
  const next = { ...m };
  next.reserveToken += tokensIn;
  next.reserveQuote -= q.gross;
  next.realQuote -= q.gross;
  if (!next.graduated) next.curveLeft += tokensIn;
  next.volume += q.gross;
  return next;
}

export function newMarket(virtualQuote: bigint, createdAt: number): MarketState {
  return {
    createdAt,
    graduated: false,
    virtualQuote,
    reserveToken: VIRTUAL_TOKENS,
    reserveQuote: virtualQuote,
    realQuote: 0n,
    curveLeft: CURVE_SUPPLY,
    volume: 0n,
  };
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

export function virtualQuoteFor(c: CurrencyRate, targetRaiseUsd: bigint): bigint {
  const raise = fromUsd(c, targetRaiseUsd);
  return (raise * POOL_SUPPLY) / (CURVE_SUPPLY - POOL_SUPPLY);
}

export function curveRaise(virtualQuote: bigint): bigint {
  return (virtualQuote * (CURVE_SUPPLY - POOL_SUPPLY)) / POOL_SUPPLY;
}

/* ------------------------------ read-outs ------------------------------ */

/** Price of one whole coin in whole units of its currency. */
export function priceOf(m: Pick<MarketState, 'reserveQuote' | 'reserveToken'>, quoteDecimals = 18): number {
  if (m.reserveToken === 0n) return 0;
  const scaled = (m.reserveQuote * WAD * pow10(18 - quoteDecimals)) / m.reserveToken;
  return Number(scaled) / 1e18;
}

export function marketCap(m: MarketState, quoteDecimals = 18): number {
  return priceOf(m, quoteDecimals) * 1e9;
}

/** Share of the curve sold, 0..1 (1 once graduated). */
export function progress(m: Pick<MarketState, 'curveLeft' | 'graduated'>): number {
  if (m.graduated) return 1;
  return Number(((CURVE_SUPPLY - m.curveLeft) * 1_000_000n) / CURVE_SUPPLY) / 1_000_000;
}

/** Price at which a curve that started with `virtualQuote` graduates. */
export function graduationPrice(virtualQuote: bigint): number {
  const x = VIRTUAL_TOKENS - CURVE_SUPPLY;
  const y = mulDiv(virtualQuote, VIRTUAL_TOKENS, x);
  return Number((y * WAD) / x) / 1e18;
}

/** What the backing would pay if every circulating coin were sold at once (curve only). */
export function fullSellBack(m: MarketState): bigint {
  const circulating = m.graduated ? TOTAL_SUPPLY - m.reserveToken : CURVE_SUPPLY - m.curveLeft;
  if (circulating === 0n) return 0n;
  return mulDiv(m.reserveQuote, circulating, m.reserveToken + circulating);
}

export function circulating(m: MarketState): bigint {
  return m.graduated ? TOTAL_SUPPLY - m.reserveToken : CURVE_SUPPLY - m.curveLeft;
}
