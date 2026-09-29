/**
 * The launchpad registry. Chains, pads, pairs and their logos are data, so
 * adding a venue is a new entry here plus an adapter in lib/server/adapters.ts.
 *
 * Logos in /public/logos are the trademarks of their owners and are used
 * only to identify each venue, chain and asset.
 */

export type ChainId = "solana" | "bsc" | "robinhood" | "arc";
export type AddressKind = "base58" | "evm";

export interface Chain {
  id: ChainId;
  name: string;
  /** Shorter label for tight spots (chain picker on phones). */
  short: string;
  native: string;
  /** Smallest opening buy, in the native asset. */
  minBuy: number;
  addressKind: AddressKind;
  color: string;
  logo: string;
  explorer: string;
}

export interface Pad {
  id: string;
  name: string;
  chain: ChainId;
  /** Pair symbols; "STOCK" means the pad pairs with any tokenised stock below. */
  pairs: string[];
  logo: string;
  color: string;
  monogram: string;
  url: string;
  blurb: string;
  /** The home pad: listed first and preselected in the studio. */
  featured?: boolean;
}

export interface Asset {
  symbol: string;
  name: string;
  logo: string;
  /** Vector brand mark for large tiles (crisp at any size). */
  mark?: string;
  stock?: boolean;
}

export const chains: Chain[] = [
  {
    id: "solana",
    name: "Solana",
    short: "Solana",
    native: "SOL",
    minBuy: 0.01,
    addressKind: "base58",
    color: "#3DD9B3",
    logo: "/logos/solana.png",
    explorer: "https://solscan.io/token/",
  },
  {
    id: "bsc",
    name: "BNB Chain",
    short: "BNB",
    native: "BNB",
    minBuy: 0.005,
    addressKind: "evm",
    color: "#F5C84B",
    logo: "/logos/bnb.png",
    explorer: "https://bscscan.com/token/",
  },
  {
    id: "robinhood",
    name: "Robinhood Chain",
    short: "Robinhood",
    native: "ETH",
    minBuy: 0.001,
    addressKind: "evm",
    color: "#CCFF00",
    logo: "/logos/robinhood.png",
    explorer: "https://explorer.mainnet.chain.robinhood.com/address/",
  },
  {
    id: "arc",
    name: "Arc",
    short: "Arc",
    native: "USDC",
    minBuy: 1,
    addressKind: "evm",
    color: "#7C9CFF",
    logo: "/logos/arc.png",
    explorer: "https://argus.world/token/",
  },
];

export const pads: Pad[] = [
  {
    id: "pons",
    name: "Pons",
    chain: "robinhood",
    pairs: ["ETH", "USDG", "STOCK", "cbBTC"],
    logo: "/logos/pons.png",
    color: "#D9D9D9",
    monogram: "Po",
    url: "https://www.ponsfamily.com/launchpad",
    blurb: "The home pad. Pair with ETH, USDG, cbBTC or a tokenised stock.",
    featured: true,
  },
  {
    id: "pump",
    name: "Pump.fun",
    chain: "solana",
    pairs: ["SOL", "STOCK"],
    logo: "/logos/pump.png",
    color: "#3DD9B3",
    monogram: "Pf",
    url: "https://pump.fun",
    blurb: "Bonding-curve launches with the deepest Solana audience.",
  },
  {
    id: "stonk",
    name: "StonkFun",
    chain: "solana",
    pairs: ["STOCK"],
    logo: "/logos/stonkfun.png",
    color: "#5CC8E8",
    monogram: "Sf",
    url: "https://www.stonkfun.xyz",
    blurb: "Coins that pair straight to a tokenised stock.",
  },
  {
    id: "four",
    name: "Four.meme",
    chain: "bsc",
    pairs: ["BNB", "STOCK", "BTC"],
    logo: "/logos/four.png",
    color: "#7CF2B0",
    monogram: "4m",
    url: "https://four.meme",
    blurb: "The busiest fair-launch venue on BNB Chain.",
  },
  {
    id: "flap",
    name: "Flap",
    chain: "bsc",
    pairs: ["BNB", "STOCK", "BTC"],
    logo: "/logos/flap.png",
    color: "#7B5CFF",
    monogram: "Fl",
    url: "https://www.flap.sh",
    blurb: "Lightweight BNB launches with BTC and stock pairs.",
  },
  {
    id: "argus",
    name: "Argus",
    chain: "arc",
    pairs: ["USDC"],
    logo: "/logos/argus.png",
    color: "#7C9CFF",
    monogram: "Ar",
    url: "https://argus.world",
    blurb: "USDC-native launches on Arc.",
  },
];

/** Pair assets and the tokenised stocks a "STOCK" pad can pair with. */
export const assets: Asset[] = [
  { symbol: "ETH", name: "Ether", logo: "/logos/eth.png" },
  { symbol: "USDG", name: "Global Dollar", logo: "/logos/usdc.png" },
  { symbol: "USDC", name: "USD Coin", logo: "/logos/usdc.png" },
  { symbol: "SOL", name: "Solana", logo: "/logos/solana.png" },
  { symbol: "BNB", name: "BNB", logo: "/logos/bnb.png" },
  { symbol: "BTC", name: "Bitcoin", logo: "/logos/stocks/BTC.png" },
  { symbol: "cbBTC", name: "Coinbase Wrapped BTC", logo: "/logos/stocks/cbBTC.png" },
  { symbol: "TSLA", name: "Tesla", logo: "/logos/stocks/TSLA.png", mark: "/logos/brands/tesla.svg", stock: true },
  { symbol: "NVDA", name: "NVIDIA", logo: "/logos/stocks/NVDA.png", mark: "/logos/brands/nvidia.svg", stock: true },
  { symbol: "AAPL", name: "Apple", logo: "/logos/stocks/AAPL.png", mark: "/logos/brands/apple.svg", stock: true },
  { symbol: "HOOD", name: "Robinhood", logo: "/logos/brands/robinhood-badge.svg", mark: "/logos/brands/robinhood.svg", stock: true },
  { symbol: "COIN", name: "Coinbase", logo: "/logos/brands/coinbase.svg", mark: "/logos/brands/coinbase.svg", stock: true },
  { symbol: "META", name: "Meta", logo: "/logos/stocks/meta.png", mark: "/logos/brands/meta.svg", stock: true },
  { symbol: "SPY", name: "SPDR S&P 500", logo: "/logos/stocks/spy.png", stock: true },
  { symbol: "QQQ", name: "Invesco QQQ", logo: "/logos/stocks/QQQ.png", stock: true },
  { symbol: "AMZN", name: "Amazon", logo: "/logos/stocks/AMZN.png", stock: true },
  { symbol: "GOOGL", name: "Alphabet", logo: "/logos/stocks/GOOGL.png", stock: true },
  { symbol: "MSFT", name: "Microsoft", logo: "/logos/stocks/MSFT.png", stock: true },
  { symbol: "NFLX", name: "Netflix", logo: "/logos/stocks/NFLX.png", stock: true },
  { symbol: "PLTR", name: "Palantir", logo: "/logos/stocks/PLTR.png", stock: true },
  { symbol: "AMD", name: "AMD", logo: "/logos/stocks/AMD.png", stock: true },
  { symbol: "MSTR", name: "Strategy", logo: "/logos/stocks/MSTR.png", stock: true },
  { symbol: "CRCL", name: "Circle", logo: "/logos/stocks/CRCL.png", stock: true },
];

export const stocks = assets.filter((a) => a.stock);
/** The six stocks shown on the Explore tile, in order. */
export const featuredStocks = ["TSLA", "NVDA", "AAPL", "HOOD", "COIN", "META"].map((s) => getAsset(s)!);

export const defaultPad = pads.find((p) => p.featured) ?? pads[0];

export function getChain(id: string | null | undefined): Chain | undefined {
  return chains.find((c) => c.id === id);
}

export function getPad(id: string | null | undefined): Pad | undefined {
  return pads.find((p) => p.id === id);
}

export function getAsset(symbol: string | null | undefined): Asset | undefined {
  return assets.find((a) => a.symbol === symbol);
}

export function padsOn(chain: ChainId): Pad[] {
  return pads.filter((p) => p.chain === chain);
}

export function supportsStocks(pad: Pad) {
  return pad.pairs.includes("STOCK");
}

/** The non-stock pairs a pad lists directly (its chips in the studio). */
export function basePairs(pad: Pad): string[] {
  return pad.pairs.filter((p) => p !== "STOCK");
}

/** Every symbol a pad accepts as its pair. */
export function pairOptions(pad: Pad): string[] {
  return [...basePairs(pad), ...(supportsStocks(pad) ? stocks.map((s) => s.symbol) : [])];
}

export function isValidPair(pad: Pad, symbol: string | null | undefined): boolean {
  return Boolean(symbol) && pairOptions(pad).includes(symbol!);
}

/** "ETH · USDG · Stocks · cbBTC" */
export function pairsLabel(pad: Pad): string {
  return pad.pairs.map((p) => (p === "STOCK" ? "Stocks" : p)).join(" · ");
}

/**
 * Resolve a possibly partial or inconsistent (chain, pad, pair) triple from a
 * URL into a valid one, falling back step by step.
 */
export function resolveSelection(input: { chain?: string | null; pad?: string | null; pair?: string | null }) {
  const byPad = getPad(input.pad);
  const byChain = getChain(input.chain);
  const pad = byPad && (!byChain || byPad.chain === byChain.id) ? byPad : byChain ? padsOn(byChain.id)[0] : defaultPad;
  const pair = isValidPair(pad, input.pair) ? input.pair! : pairOptions(pad)[0];
  return { chain: getChain(pad.chain)!, pad, pair };
}

export function isValidAddress(kind: AddressKind, value: string): boolean {
  if (kind === "evm") return /^0x[a-fA-F0-9]{40}$/.test(value);
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}
