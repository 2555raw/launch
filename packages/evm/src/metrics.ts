/**
 * Holder counts for Robinhood Chain tokens come from the chain's Blockscout explorer API.
 * Returns null when the explorer has not indexed the token yet ("Data unavailable").
 */
export async function fetchBlockscoutHolderCount(explorerBaseUrl: string, tokenAddress: string, fetchImpl: typeof fetch = fetch): Promise<number | null> {
  try {
    const res = await fetchImpl(`${explorerBaseUrl.replace(/\/$/, '')}/api/v2/tokens/${tokenAddress}`, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const body = (await res.json()) as { holders?: string | number; holders_count?: string | number };
    const raw = body.holders ?? body.holders_count;
    if (raw === undefined || raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
