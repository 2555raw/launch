/**
 * Which studio selections launch on-chain today, and the chain details the
 * wallet needs. Shared by the studio (to show the wallet button) and the
 * server (to accept the launch). Pair token addresses live on the server.
 */
export const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

/** Rough SOL a Pump.fun create costs before any opening buy (rent + fees). */
export const PUMP_CREATE_COST_SOL = 0.025;

export type WalletKind = "solana" | "evm";

export interface EvmChain {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  explorer: string;
}

export const evmChains: Record<string, EvmChain> = {
  bsc: {
    chainId: 56,
    chainName: "BNB Smart Chain",
    rpcUrl: "https://bsc-dataseed.bnbchain.org",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    explorer: "https://bscscan.com",
  },
  robinhood: {
    chainId: 4663,
    chainName: "Robinhood Chain",
    rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    explorer: "https://robinhoodchain.blockscout.com",
  },
  arc: {
    chainId: 5042,
    chainName: "Arc",
    rpcUrl: "https://rpc.mainnet.arc.io",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    explorer: "https://explorer.arc.io",
  },
};

/** Stocks each pad can pair with on-chain (the server holds their token addresses). */
const PONS_STOCKS = ["TSLA", "NVDA", "AAPL", "COIN", "META", "SPY", "QQQ", "AMZN", "GOOGL", "MSFT", "NFLX", "PLTR", "AMD", "MSTR", "CRCL"];
export const FLAP_STOCKS = ["NVDA", "AAPL", "TSLA", "MSFT", "GOOGL", "SPY", "QQQ", "HOOD", "NFLX", "MSTR"];
const STONK_STOCKS = ["TSLA", "NVDA", "AAPL", "META", "MSFT", "AMZN", "COIN", "GOOGL", "SPY", "QQQ"];

interface Support {
  wallet: WalletKind;
  /** Pairs that launch on-chain. */
  pairs: string[];
  /** Pairs where an opening buy is supported (paid in that pair). */
  buyPairs: string[];
}

export const onchainPads: Record<string, Support> = {
  pump: { wallet: "solana", pairs: ["SOL"], buyPairs: ["SOL"] },
  pons: { wallet: "evm", pairs: ["ETH", "USDG", "cbBTC", ...PONS_STOCKS], buyPairs: ["ETH"] },
  // flap: { wallet: "evm", pairs: ["BNB", "BTC", ...FLAP_STOCKS], buyPairs: ["BNB"] },
  argus: { wallet: "evm", pairs: ["USDC"], buyPairs: ["USDC"] },
  stonk: { wallet: "solana", pairs: STONK_STOCKS, buyPairs: [] },
};

export function onchainSupport(f: { mode: string; pad: string; pair: string }): Support | null {
  const s = onchainPads[f.pad];
  return f.mode === "create" && s?.pairs.includes(f.pair) ? s : null;
}

export function canLaunchOnChain(f: { mode: string; pad: string; pair: string }): boolean {
  return onchainSupport(f) !== null;
}

export function supportsOpeningBuy(f: { mode: string; pad: string; pair: string }): boolean {
  return Boolean(onchainSupport(f)?.buyPairs.includes(f.pair));
}

export function pumpCoinUrl(mint: string) {
  return `https://pump.fun/coin/${mint}`;
}

export function solscanTxUrl(signature: string) {
  return `https://solscan.io/tx/${signature}`;
}

export function txUrl(chain: string, hash: string) {
  const evm = evmChains[chain];
  return evm ? `${evm.explorer}/tx/${hash}` : solscanTxUrl(hash);
}

/** Where to see the new token on its own launchpad (only where the URL format is confirmed). */
export function padTokenUrl(pad: string, token: string): string | null {
  return pad === "pump" ? pumpCoinUrl(token) : null;
}

export function shortAddress(a: string) {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}
