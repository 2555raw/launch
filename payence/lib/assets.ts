/**
 * The asset registry. Adding a token is one entry here plus its contract
 * addresses per network in lib/networks.ts; nothing else in the app hardcodes
 * a symbol.
 */
export type AssetId = "USDC" | "USDT" | "EURC";
export type FiatCurrency = "EUR" | "USD";

export type Asset = {
  id: AssetId;
  name: string;
  symbol: string;
  decimals: number;
  /** The fiat currency this stablecoin tracks; used for the default display rate. */
  peg: FiatCurrency;
  issuer: string;
  /** Sort order in wallet lists. */
  rank: number;
  colour: string;
};

export const ASSETS: Record<AssetId, Asset> = {
  USDC: { id: "USDC", name: "USD Coin", symbol: "USDC", decimals: 6, peg: "USD", issuer: "Circle", rank: 1, colour: "#2775CA" },
  EURC: { id: "EURC", name: "Euro Coin", symbol: "EURC", decimals: 6, peg: "EUR", issuer: "Circle", rank: 2, colour: "#1A6BFF" },
  USDT: { id: "USDT", name: "Tether USD", symbol: "USDT", decimals: 6, peg: "USD", issuer: "Tether", rank: 3, colour: "#26A17B" },
};

export const ASSET_IDS = Object.keys(ASSETS) as AssetId[];
export const FIAT_CURRENCIES: FiatCurrency[] = ["EUR", "USD"];

export function isAssetId(v: unknown): v is AssetId {
  return typeof v === "string" && v in ASSETS;
}

export function isFiat(v: unknown): v is FiatCurrency {
  return v === "EUR" || v === "USD";
}

export function asset(id: AssetId): Asset {
  return ASSETS[id];
}

export const FIAT_SYMBOL: Record<FiatCurrency, string> = { EUR: "€", USD: "$" };
