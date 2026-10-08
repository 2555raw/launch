/** Response shapes of the /robinhood/* API routes (mirrors @launch/robinhood provider types). */
export interface RhCapability {
  name: string;
  available: boolean;
  reason: string;
  docs?: string;
}
export interface RhCapabilities {
  capabilities: RhCapability[];
  apiBaseUrl: string;
  linked: boolean;
}
export interface RhConnection {
  label: string | null;
  publicKeyBase64: string;
  lastVerifiedAt: string | null;
  createdAt: string;
}
export interface RhAccount {
  account_number: string;
  status: string;
  buying_power: string;
  buying_power_currency: string;
  [key: string]: unknown;
}
export interface RhHolding {
  account_number: string;
  asset_code: string;
  total_quantity: string;
  quantity_available_for_trading: string;
  [key: string]: unknown;
}
export interface RhQuote {
  symbol: string;
  price: string;
  bid_inclusive_of_sell_spread: string;
  sell_spread: string;
  ask_inclusive_of_buy_spread: string;
  buy_spread: string;
  timestamp: string;
  [key: string]: unknown;
}
export interface RhOrder {
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
