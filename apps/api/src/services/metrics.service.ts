import type { FastifyInstance } from 'fastify';
import { fetchBlockscoutHolderCount } from '@launch/evm';
import { fetchDexScreenerMetrics, getHolderCount } from '@launch/solana';
import type { TokenMetricsDTO } from '@launch/types';
import { evmExplorerBase, solanaConnection } from '../lib/chains.js';

const STALE_MS = 60_000;

/** Fetches live metrics for one token: DexScreener market data + an on-chain/explorer holder count. */
export async function refreshTokenMetrics(app: FastifyInstance, tokenId: string): Promise<TokenMetricsDTO> {
  const { env, db } = app.deps;
  const token = await db.token.findUniqueOrThrow({ where: { id: tokenId } });
  const chainId = token.chain === 'SOLANA' ? 'solana' : 'robinhood';
  let metrics: TokenMetricsDTO | null = null;
  try {
    metrics = await fetchDexScreenerMetrics(env.DEXSCREENER_API_URL, chainId, token.address);
  } catch (e) {
    app.log.warn({ err: e, token: token.address }, 'dexscreener fetch failed');
  }
  if (!metrics) {
    metrics = { source: 'onchain', priceUsd: null, marketCapUsd: null, fdvUsd: null, liquidityUsd: null, volume24hUsd: null, txns24h: null, holders: null, pairAddress: null, dexId: null, dexUrl: null, fetchedAt: new Date().toISOString() };
  }
  try {
    metrics.holders = token.chain === 'SOLANA' ? await getHolderCount(solanaConnection(env), token.address) : await fetchBlockscoutHolderCount(evmExplorerBase(env), token.address);
  } catch {
    metrics.holders = null;
  }
  await db.token.update({ where: { id: tokenId }, data: { metrics: metrics as object, metricsFetchedAt: new Date() } });
  return metrics;
}

export async function getMetrics(app: FastifyInstance, token: { id: string; metrics: unknown; metricsFetchedAt: Date | null }): Promise<TokenMetricsDTO | null> {
  const fresh = token.metricsFetchedAt && Date.now() - token.metricsFetchedAt.getTime() < STALE_MS;
  if (fresh && token.metrics) return token.metrics as TokenMetricsDTO;
  try {
    return await refreshTokenMetrics(app, token.id);
  } catch (e) {
    app.log.warn({ err: e }, 'metrics refresh failed');
    return (token.metrics as TokenMetricsDTO) ?? null;
  }
}

/** Background loop: keeps published tokens' metrics warm (bounded, sequential, rate-limit friendly). */
export function startMetricsRefresher(app: FastifyInstance, intervalMs = 120_000): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const tokens = await app.deps.db.token.findMany({ where: { OR: [{ metricsFetchedAt: null }, { metricsFetchedAt: { lt: new Date(Date.now() - intervalMs) } }] }, orderBy: { metricsFetchedAt: 'asc' }, take: 25 });
      for (const t of tokens) {
        if (stopped) return;
        await refreshTokenMetrics(app, t.id).catch(() => undefined);
        await new Promise((r) => setTimeout(r, 400));
      }
    } catch (e) {
      app.log.warn({ err: e }, 'metrics refresher tick failed');
    }
  };
  const timer = setInterval(tick, intervalMs);
  setTimeout(tick, 5_000);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
