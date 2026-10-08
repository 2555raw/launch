/**
 * RobinhoodProvider — the single abstraction the rest of the platform talks to.
 *
 * What exists publicly today (verified against docs.robinhood.com/crypto/trading on 2026-10-08):
 *   • Robinhood Crypto Trading API — official, documented, key + Ed25519 signature auth.
 *     Implemented for real in `RobinhoodCryptoClient`.
 *   • Robinhood Chain — public EVM L2 (chain id 4663 mainnet / 46630 testnet). Handled by @launch/evm.
 *
 * What does NOT exist publicly:
 *   • A public API for US stock / options / ETF trading or brokerage account data. Robinhood's
 *     "open to agents" program (May 2026) is account-side and has no published developer API.
 *     `UnavailableRobinhoodBrokerageProvider` reports this honestly instead of faking data.
 */

export interface RobinhoodAccount {
  account_number: string;
  status: string;
  buying_power: string;
  buying_power_currency: string;
  [key: string]: unknown;
}

export interface RobinhoodHolding {
  account_number: string;
  asset_code: string;
  total_quantity: string;
  quantity_available_for_trading: string;
  [key: string]: unknown;
}

export interface RobinhoodTradingPair {
  symbol: string;
  asset_code: string;
  quote_code: string;
  status: string;
  [key: string]: unknown;
}

export interface RobinhoodBestBidAsk {
  symbol: string;
  price: string;
  bid_inclusive_of_sell_spread: string;
  sell_spread: string;
  ask_inclusive_of_buy_spread: string;
  buy_spread: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface RobinhoodEstimatedPrice {
  symbol: string;
  side: string;
  price: string;
  quantity: string;
  bid_inclusive_of_sell_spread?: string;
  ask_inclusive_of_buy_spread?: string;
  [key: string]: unknown;
}

export type RobinhoodOrderSide = 'buy' | 'sell';
export type RobinhoodOrderType = 'market' | 'limit' | 'stop_loss' | 'stop_limit';

export interface RobinhoodOrderRequest {
  client_order_id: string;
  side: RobinhoodOrderSide;
  type: RobinhoodOrderType;
  symbol: string;
  market_order_config?: { asset_quantity: string };
  limit_order_config?: { asset_quantity?: string; quote_amount?: string; limit_price: string; time_in_force: 'gtc' };
  stop_loss_order_config?: { asset_quantity?: string; quote_amount?: string; stop_price: string; time_in_force: 'gtc' };
  stop_limit_order_config?: { asset_quantity?: string; quote_amount?: string; limit_price: string; stop_price: string; time_in_force: 'gtc' };
}

export interface RobinhoodOrder {
  id: string;
  account_number: string;
  symbol: string;
  client_order_id: string;
  side: string;
  type: string;
  state: string;
  average_price: number | null;
  filled_asset_quantity: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface Paged<T> {
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface RobinhoodCryptoProvider {
  readonly kind: 'crypto';
  getAccount(): Promise<RobinhoodAccount>;
  getHoldings(assetCodes?: string[]): Promise<Paged<RobinhoodHolding>>;
  getTradingPairs(symbols?: string[]): Promise<Paged<RobinhoodTradingPair>>;
  getBestBidAsk(symbols: string[]): Promise<{ results: RobinhoodBestBidAsk[] }>;
  getEstimatedPrice(symbol: string, side: 'bid' | 'ask' | 'both', quantities: string[]): Promise<{ results: RobinhoodEstimatedPrice[] }>;
  placeOrder(order: RobinhoodOrderRequest): Promise<RobinhoodOrder>;
  getOrders(): Promise<Paged<RobinhoodOrder>>;
  getOrder(orderId: string): Promise<RobinhoodOrder>;
  cancelOrder(orderId: string): Promise<unknown>;
}

export interface ProviderCapability {
  name: string;
  available: boolean;
  reason: string;
  docs?: string;
}

export const ROBINHOOD_CAPABILITIES: ProviderCapability[] = [
  { name: 'Crypto trading (account, holdings, market data, orders)', available: true, reason: 'Official Robinhood Crypto Trading API. Users link their own API key + Ed25519 key pair.', docs: 'https://docs.robinhood.com/crypto/trading/' },
  { name: 'Robinhood Chain token launch, balances, explorer', available: true, reason: 'Robinhood Chain is a public EVM L2; handled through JSON-RPC with the user\'s wallet.', docs: 'https://docs.robinhood.com/chain' },
  { name: 'Stock / ETF / options trading', available: false, reason: 'Robinhood publishes no public brokerage trading API. Activation requires an official partner API or the agent program exposing one; see docs/ROBINHOOD.md.' },
  { name: 'Brokerage portfolio read', available: false, reason: 'No public API. Do not use unofficial reverse-engineered endpoints: they violate Robinhood\'s terms.' },
  { name: 'OAuth login with Robinhood', available: false, reason: 'Robinhood does not offer third-party OAuth.' },
];

export class RobinhoodFeatureUnavailableError extends Error {
  constructor(public readonly feature: string) {
    super(`${feature} is not available: Robinhood exposes no public API for it. See docs/ROBINHOOD.md for what activation would require.`);
  }
}

/** Honest placeholder for brokerage (non-crypto) features. Every method throws a typed error. */
export class UnavailableRobinhoodBrokerageProvider {
  readonly kind = 'brokerage' as const;
  getPositions(): Promise<never> {
    return Promise.reject(new RobinhoodFeatureUnavailableError('Brokerage positions'));
  }
  placeStockOrder(): Promise<never> {
    return Promise.reject(new RobinhoodFeatureUnavailableError('Stock orders'));
  }
}
