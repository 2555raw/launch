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
  color: string;
}

export interface CoinMeta {
  description: string;
  image: string;
  links: { website?: string; x?: string; telegram?: string };
}

export interface Coin extends MarketState {
  address: Address;
  name: string;
  symbol: string;
  creator: Address;
  currency: Address;
  meta: CoinMeta;
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

export type TxStage = 'approve' | 'sign' | 'pending' | 'done';

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
}
