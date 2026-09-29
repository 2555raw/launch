/**
 * The launchpad registry. Chains, pads and pairs are data, so adding a venue
 * is a new entry here plus an adapter in lib/server/adapters.ts.
 *
 * Pairs and minimum opening buys are product configuration; confirm them
 * against each venue before wiring a live adapter.
 */

export type ChainId = "solana" | "bsc" | "base";
export type AddressKind = "base58" | "evm";

export interface Chain {
  id: ChainId;
  name: string;
  short: string;
  native: string;
  addressKind: AddressKind;
  /** Tile colour used for the chain across the UI. */
  color: string;
  explorer: string;
}

export interface Pair {
  symbol: string;
  /** Smallest opening buy the form accepts, in units of the pair asset. */
  minBuy: number;
}

export interface Pad {
  id: string;
  name: string;
  chain: ChainId;
  monogram: string;
  color: string;
  pairs: Pair[];
  url: string;
  blurb: string;
  featured?: boolean;
}

export const chains: Chain[] = [
  {
    id: "solana",
    name: "Solana",
    short: "SOL",
    native: "SOL",
    addressKind: "base58",
    color: "#3DD9B3",
    explorer: "https://solscan.io/token/",
  },
  {
    id: "bsc",
    name: "BNB Chain",
    short: "BNB",
    native: "BNB",
    addressKind: "evm",
    color: "#F5C84B",
    explorer: "https://bscscan.com/token/",
  },
  {
    id: "base",
    name: "Base",
    short: "BASE",
    native: "ETH",
    addressKind: "evm",
    color: "#7C9CFF",
    explorer: "https://basescan.org/token/",
  },
];

export const pads: Pad[] = [
  {
    id: "pumpfun",
    name: "Pump.fun",
    chain: "solana",
    monogram: "Pf",
    color: "#3DD9B3",
    pairs: [{ symbol: "SOL", minBuy: 0.01 }],
    url: "https://pump.fun",
    blurb: "Bonding-curve launches with the deepest Solana audience.",
    featured: true,
  },
  {
    id: "bonk",
    name: "Bonk.fun",
    chain: "solana",
    monogram: "Bk",
    color: "#FF9F43",
    pairs: [
      { symbol: "SOL", minBuy: 0.01 },
      { symbol: "USD1", minBuy: 1 },
    ],
    url: "https://bonk.fun",
    blurb: "Community launchpad with SOL and stablecoin pairs.",
  },
  {
    id: "fourmeme",
    name: "Four.meme",
    chain: "bsc",
    monogram: "4m",
    color: "#F5C84B",
    pairs: [{ symbol: "BNB", minBuy: 0.005 }],
    url: "https://four.meme",
    blurb: "The busiest fair-launch venue on BNB Chain.",
  },
  {
    id: "flap",
    name: "Flap",
    chain: "bsc",
    monogram: "Fl",
    color: "#C9A7FF",
    pairs: [{ symbol: "BNB", minBuy: 0.005 }],
    url: "https://flap.sh",
    blurb: "Lightweight BNB launches with instant listing.",
  },
  {
    id: "clanker",
    name: "Clanker",
    chain: "base",
    monogram: "Cl",
    color: "#7C9CFF",
    pairs: [{ symbol: "WETH", minBuy: 0.001 }],
    url: "https://clanker.world",
    blurb: "Agent-friendly token deployer on Base.",
  },
  {
    id: "zora",
    name: "Zora",
    chain: "base",
    monogram: "Zo",
    color: "#FF6A3D",
    pairs: [
      { symbol: "ETH", minBuy: 0.001 },
      { symbol: "ZORA", minBuy: 10 },
    ],
    url: "https://zora.co",
    blurb: "Creator coins with onchain media baked in.",
  },
];

export const defaultPad = pads.find((p) => p.featured) ?? pads[0];

export function getChain(id: string | null | undefined): Chain | undefined {
  return chains.find((c) => c.id === id);
}

export function getPad(id: string | null | undefined): Pad | undefined {
  return pads.find((p) => p.id === id);
}

export function padsOn(chain: ChainId): Pad[] {
  return pads.filter((p) => p.chain === chain);
}

export function getPair(pad: Pad, symbol: string | null | undefined): Pair | undefined {
  return pad.pairs.find((p) => p.symbol === symbol);
}

/**
 * Resolve a possibly partial or inconsistent (chain, pad, pair) triple from a
 * URL into a valid one, falling back step by step.
 */
export function resolveSelection(input: { chain?: string | null; pad?: string | null; pair?: string | null }) {
  const pad =
    getPad(input.pad) && (!input.chain || getPad(input.pad)!.chain === input.chain)
      ? getPad(input.pad)!
      : getChain(input.chain)
        ? padsOn(getChain(input.chain)!.id)[0]
        : defaultPad;
  const pair = getPair(pad, input.pair) ?? pad.pairs[0];
  return { chain: getChain(pad.chain)!, pad, pair };
}

export function isValidAddress(kind: AddressKind, value: string): boolean {
  if (kind === "evm") return /^0x[a-fA-F0-9]{40}$/.test(value);
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}
