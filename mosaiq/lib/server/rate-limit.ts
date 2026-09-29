import "server-only";

/**
 * Fixed-window limiter held in memory. Good enough for one instance; move it
 * to Redis/KV together with the store when running several.
 */
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  return { ok: b.count <= limit, retryAfter: Math.ceil((b.reset - now) / 1000) };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
