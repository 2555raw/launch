import "server-only";

/**
 * USD prices for the assets launches are paired with: CoinGecko for crypto,
 * the xStocks on Solana (via Dexscreener) for tokenised US stocks, and $1 for
 * dollar stablecoins. Cached for a minute; null when no source answers.
 */
const COINGECKO: Record<string, string> = { ETH: "ethereum", BTC: "bitcoin", cbBTC: "bitcoin", BNB: "binancecoin", SOL: "solana" };
const STABLE = new Set(["USDG", "USDC", "USDT", "USD1"]);
/** xStock mints on Solana, used as the USD reference for each stock. */
const XSTOCKS: Record<string, string> = {
  TSLA: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
  NVDA: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
  AAPL: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
  HOOD: "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg",
  COIN: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu",
  META: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu",
  SPY: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
  QQQ: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ",
  AMZN: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg",
  GOOGL: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
  MSFT: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX",
  PLTR: "XsoBhf2ufR8fTyNSjqfU71DYGaE6Z3SUGAidpzriAA4",
  MSTR: "XsP7xzNPvEHS1m6qfanPUGjNmdnmsLKEoNAnHjdxxyZ",
  CRCL: "XsueG8BtpquVJX9LVLLEGuViXUungE6WmK5YZ3p3bd1",
};

const cache = new Map<string, { at: number; usd: number | null }>();

async function fetchUsd(symbol: string): Promise<number | null> {
  if (STABLE.has(symbol)) return 1;
  const cg = COINGECKO[symbol];
  if (cg) {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cg}&vs_currencies=usd`, { signal: AbortSignal.timeout(8_000) }).catch(() => null);
    const data = res?.ok ? ((await res.json().catch(() => null)) as Record<string, { usd?: number }> | null) : null;
    return data?.[cg]?.usd ?? null;
  }
  const mint = XSTOCKS[symbol];
  if (!mint) return null;
  const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, { signal: AbortSignal.timeout(8_000) }).catch(() => null);
  const pairs = res?.ok ? ((await res.json().catch(() => [])) as { baseToken?: { address?: string }; priceUsd?: string; liquidity?: { usd?: number } }[]) : [];
  const best = pairs
    .filter((p) => p.baseToken?.address === mint && Number(p.priceUsd) > 0)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  return best ? Number(best.priceUsd) : null;
}

export async function usdPrice(symbol: string): Promise<number | null> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < 60_000) return hit.usd;
  const usd = await fetchUsd(symbol).catch(() => null);
  cache.set(symbol, { at: Date.now(), usd });
  return usd;
}
