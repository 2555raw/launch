import type { TokenMetricsDTO } from '@launch/types';

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  txns?: Record<string, { buys: number; sells: number }>;
  volume?: Record<string, number>;
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

/**
 * Pulls live market data for a token from DexScreener (public, keyless). Returns the normalized
 * metrics or `null` when no pair exists — the UI must then show "Data unavailable".
 */
export async function fetchDexScreenerMetrics(baseUrl: string, chainId: 'solana' | 'robinhood', tokenAddress: string, fetchImpl: typeof fetch = fetch): Promise<TokenMetricsDTO | null> {
  const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/token-pairs/v1/${chainId}/${tokenAddress}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`DexScreener responded ${res.status}`);
  const pairs = (await res.json()) as DexScreenerPair[];
  if (!Array.isArray(pairs) || pairs.length === 0) return null;
  const sorted = [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  const best = sorted[0];
  const txns = best.txns?.h24;
  return {
    source: 'dexscreener',
    priceUsd: best.priceUsd ? Number(best.priceUsd) : null,
    marketCapUsd: best.marketCap ?? null,
    fdvUsd: best.fdv ?? null,
    liquidityUsd: sorted.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0) || null,
    volume24hUsd: sorted.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0) || null,
    txns24h: txns ? txns.buys + txns.sells : null,
    holders: null,
    pairAddress: best.pairAddress,
    dexId: best.dexId,
    dexUrl: best.url,
    fetchedAt: new Date().toISOString(),
  };
}
