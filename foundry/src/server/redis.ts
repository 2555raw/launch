import Redis from "ioredis";
import { env } from "./env";

const g = globalThis as unknown as { redis?: Redis };

export const redis: Redis = g.redis ?? new Redis(env.redisUrl, { maxRetriesPerRequest: 3, lazyConnect: false });
if (process.env.NODE_ENV !== "production") g.redis = redis;

redis.on("error", (e) => console.error("[redis]", e.message));

/** Sliding fixed-window rate limit. Returns true when the call is allowed. */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const k = `rl:${key}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, windowSec);
  return n <= limit;
}

/** Short Redis lock so two requests cannot mutate the same session at once. */
export async function withLock<T>(key: string, fn: () => Promise<T>, ttlMs = 3000, attempts = 25): Promise<T> {
  const k = `lock:${key}`;
  const token = `${process.pid}-${Date.now()}-${Math.random()}`;
  for (let i = 0; i < attempts; i++) {
    const ok = await redis.set(k, token, "PX", ttlMs, "NX");
    if (ok) {
      try {
        return await fn();
      } finally {
        // release only if we still own it
        await redis.eval(`if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0`, 1, k, token);
      }
    }
    await new Promise((r) => setTimeout(r, 40 + Math.random() * 40));
  }
  throw new Error("busy");
}
