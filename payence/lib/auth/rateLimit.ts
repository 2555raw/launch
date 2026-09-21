/**
 * In-process sliding-window limiter. It protects a single instance; behind more
 * than one, move the counters to Redis (the interface is the same).
 */
type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

export type LimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  hit.count += 1;
  if (hit.count > limit) {
    return { ok: false, remaining: 0, retryAfterSeconds: Math.ceil((hit.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - hit.count, retryAfterSeconds: 0 };
}

/** Housekeeping so the map cannot grow without bound in a long-lived process. */
export function sweepRateLimits() {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export const LIMITS = {
  login: { limit: 8, windowMs: 15 * 60_000 },
  signup: { limit: 5, windowMs: 60 * 60_000 },
  payment: { limit: 30, windowMs: 60_000 },
  api: { limit: 120, windowMs: 60_000 },
  totp: { limit: 10, windowMs: 10 * 60_000 },
} as const;
