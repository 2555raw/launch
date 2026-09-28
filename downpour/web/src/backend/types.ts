import type { MarketState } from '../lib/math';

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
  /** Its Uniswap V2 pair with the currency (live mode). */
  pair?: Address;
}

export interface Trade {
  id: string;
  coin: Address;
  trader: Address;
  isBuy: boolean;
  /** Currency paid (buy, gross) or received (sell, net). */
  quoteAmount: bigint;
  tokenAmount: bigint;
  fees: bigint;
  snipeTax: bigint;
  reserveToken: bigint;
  reserveQuote: bigint;
  timestamp: number;
  txHash?: string;
}

export interface RateMove {
  token: Address;
  oldRate: bigint;
  newRate: bigint;
  timestamp: number;
}

export interface Params {
  targetRaiseUsd: bigint;
  protocolFeeBps: number;
  creatorFeeBps: number;
  snipeTaxBps: number;
  snipeWindow: number;
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

export interface Backend {
  kind: 'live' | 'playground';
  chainId?: number;
  /** Addresses the Verify/Proof pages and links need. */
  addresses?: { launchpad: Address; desk: Address; router: Address; coinImplementation: Address };
  load(): Promise<Snapshot>;
  subscribe?(onChange: () => void): () => void;
  balances(account: Address, tokens: Address[]): Promise<Record<string, bigint>>;
  allowances(account: Address, spender: 'launchpad' | 'router' | 'desk', tokens: Address[]): Promise<Record<string, bigint>>;
  feesOwed(account: Address, currencies: Address[]): Promise<Record<string, bigint>>;
  faucetReadyAt(account: Address, token: Address): Promise<number>;
  faucet(account: Address, token: Address, o?: TxOptions): Promise<TxResult>;
  createCoin(account: Address, input: CreateCoinInput, o?: TxOptions): Promise<TxResult & { coin?: Address }>;
  buy(account: Address, coin: Address, quoteIn: bigint, minOut: bigint, o?: TxOptions): Promise<TxResult>;
  sell(account: Address, coin: Address, tokensIn: bigint, minOut: bigint, o?: TxOptions): Promise<TxResult>;
  swap(account: Address, tokenIn: Address, tokenOut: Address, amountIn: bigint, minOut: bigint, o?: TxOptions): Promise<TxResult>;
  claimFees(account: Address, currency: Address, o?: TxOptions): Promise<TxResult>;
  /** Live only: who owns the desk (may list tokens). */
  deskOwner?(): Promise<Address>;
  /** Live only, owner: list a token that trades on the chain under a currency code, at `rate` units per USD. */
  listCurrency?(account: Address, token: Address, code: string, rate: bigint, o?: TxOptions): Promise<TxResult>;
  /** Live only: turn wrapped ether back into ETH. */
  unwrap?(account: Address, token: Address, amount: bigint, o?: TxOptions): Promise<TxResult>;
  /** Live only: the best Uniswap price on this chain between two real tokens (null: no pool). */
  quoteExternal?(tokenIn: Address, tokenOut: Address, amountIn: bigint): Promise<ExternalQuote | null>;
  /** Live only: the swap `quoteExternal` priced. */
  swapExternal?(account: Address, quote: ExternalQuote, minOut: bigint, o?: TxOptions): Promise<TxResult>;
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
