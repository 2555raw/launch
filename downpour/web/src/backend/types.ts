import type { MarketState } from '../lib/math';
import type { SwapQuote } from '../lib/route';

export type Address = `0x${string}`;

export interface Currency {
  token: Address;
  code: string;
  name: string;
  symbol: string;
  region: string;
  kind: 'fiat' | 'metal' | 'crypto';
  decimals: number;
  /** Units per 1 USD, 18-decimal fixed point. */
  rate: bigint;
  updatedAt: number;
  mintable: boolean;
  /** The token's own symbol when it differs from the code (USDG listed as USD). */
  tokenSymbol?: string;
  /** What the desk holds of a real token, the most it can convert into; test currencies are minted (undefined). */
  reserve?: bigint;
  /** On a display currency only: the token the coin is actually paid in (USDG). */
  paidIn?: string;
  color: string;
}

export interface CoinMeta {
  description: string;
  image: string;
  links: { website?: string; x?: string; telegram?: string };
  /** Currency code the creator wants the coin shown and quoted in, when it is not the
   *  one it is paid in (a EUR coin paid in USDG). */
  priced?: string;
}

export interface Coin extends MarketState {
  address: Address;
  name: string;
  symbol: string;
  creator: Address;
  currency: Address;
  meta: CoinMeta;
  /** Its Uniswap V3 pool with the currency, and the pad's position in it (live mode). */
  pool?: Address;
  tokenId?: bigint;
  sqrtPriceX96?: bigint;
  liquidity?: bigint;
  /** Fees paid out so far, in the currency. */
  creatorFees: bigint;
  protocolFees: bigint;
}

export interface Trade {
  id: string;
  coin: Address;
  trader: Address;
  isBuy: boolean;
  /** Currency paid (buy, gross) or received (sell, net). */
  quoteAmount: bigint;
  tokenAmount: bigint;
  /** The pool fee, in currency terms. */
  fees: bigint;
  /** Virtual reserves right after the fill. */
  reserveToken: bigint;
  reserveQuote: bigint;
  timestamp: number;
  txHash?: string;
  /** Made through the pad, or straight on the pool from anywhere else (a terminal, Uniswap). */
  via?: 'pad' | 'pool';
}

export interface RateMove {
  token: Address;
  oldRate: bigint;
  newRate: bigint;
  timestamp: number;
}

export interface Params {
  /** What a coin's whole supply is worth the moment it launches, USD with 18 decimals. */
  startMcapUsd: bigint;
  /** The pools' fee in hundredths of a bip (10000 = 1%). */
  poolFeePips: number;
  deskFeeBps: number;
  faucetUsd: bigint;
  faucetCooldown: number;
  treasury: Address;
}

export interface Snapshot {
  currencies: Currency[];
  coins: Coin[];
  /** Newest last. */
  trades: Trade[];
  rateMoves: RateMove[];
  params: Params;
  /** Seconds to add to Date.now()/1000 to get chain time. */
  clockSkew: number;
  loadedAt: number;
}

export type TxStage = 'wrap' | 'approve' | 'sign' | 'pending' | 'done';

export interface TxOptions {
  onStage?: (stage: TxStage, detail?: string) => void;
}

export interface TxResult {
  hash?: string;
}

export interface CreateCoinInput {
  name: string;
  symbol: string;
  meta: CoinMeta;
  currency: Address;
  firstBuy: bigint;
  minTokensOut: bigint;
}

/** Fees a coin's pool has earned and not paid out yet, in the coin and in its currency. */
export interface PendingFees {
  coin: bigint;
  quote: bigint;
}

export interface Backend {
  kind: 'live' | 'playground';
  chainId?: number;
  /** Addresses the Verify/Proof pages and links need. */
  addresses?: { launchpad: Address; desk: Address; router: Address; coinImplementation: Address; positionManager?: Address };
  load(): Promise<Snapshot>;
  subscribe?(onChange: () => void): () => void;
  balances(account: Address, tokens: Address[]): Promise<Record<string, bigint>>;
  allowances(account: Address, spender: 'launchpad' | 'router' | 'desk', tokens: Address[]): Promise<Record<string, bigint>>;
  /** What each coin's pool has earned since its fees were last collected (half is the creator's). */
  pendingFees(coins: Address[]): Promise<Record<string, PendingFees>>;
  faucetReadyAt(account: Address, token: Address): Promise<number>;
  faucet(account: Address, token: Address, o?: TxOptions): Promise<TxResult>;
  createCoin(account: Address, input: CreateCoinInput, o?: TxOptions): Promise<TxResult & { coin?: Address }>;
  buy(account: Address, coin: Address, quoteIn: bigint, minOut: bigint, o?: TxOptions): Promise<TxResult>;
  sell(account: Address, coin: Address, tokensIn: bigint, minOut: bigint, o?: TxOptions): Promise<TxResult>;
  /** A route the desk can pay, in one transaction through the router. */
  swap(account: Address, tokenIn: Address, tokenOut: Address, amountIn: bigint, minOut: bigint, o?: TxOptions): Promise<TxResult>;
  /** Pays out a coin's fees: half to its creator, half to the protocol. Anyone may. */
  collectFees(account: Address, coin: Address, o?: TxOptions): Promise<TxResult>;
  /** Live only: who owns the desk (may list tokens). */
  deskOwner?(): Promise<Address>;
  /** Live only, owner: list a token that trades on the chain under a currency code, at `rate` units per USD. */
  listCurrency?(account: Address, token: Address, code: string, rate: bigint, o?: TxOptions): Promise<TxResult>;
  /** Live only: turn wrapped ether back into ETH. */
  unwrap?(account: Address, token: Address, amount: bigint, o?: TxOptions): Promise<TxResult>;
  /** Live only: the best Uniswap price on this chain between two real tokens (null: no pool). */
  quoteExternal?(tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<ExternalQuote | null>;
  /** Live only: a route with a Uniswap leg in it (sell, Uniswap, buy), one transaction per leg,
   *  each leg allowed `slipBps` below its quote. */
  swapRoute?(account: Address, quote: SwapQuote, slipBps: number, o?: TxOptions): Promise<TxResult>;
}

/** A swap between two real tokens through a Uniswap pool on the chain, priced by the pool. */
export interface ExternalQuote {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  /** 'v3' with the pool's fee in hundredths of a bip (500 = 0.05%), or 'v2'. */
  kind: 'v3' | 'v2';
  fee: number;
  /** What the page says about the route ("Uniswap V3 pool, 0.05%"). */
  via: string;
}
