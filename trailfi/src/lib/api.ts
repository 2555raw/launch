import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const json = <T>(data: T, init?: number | ResponseInit) =>
  NextResponse.json(data, typeof init === "number" ? { status: init } : init);

/** BigInt-safe JSON body for API responses. */
export function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

/**
 * Wraps a route handler: consistent error shape, CSRF origin check on
 * mutating requests, and no stack traces leaked to clients.
 */
export function route<Ctx = unknown>(handler: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status);
      if (err instanceof ZodError) {
        const issue = err.issues[0];
        return json({ error: `${issue.path.join(".") || "input"}: ${issue.message}`, code: "invalid_input" }, 400);
      }
      console.error("[api]", req.method, new URL(req.url).pathname, err);
      return json({ error: "Something went wrong. Please try again.", code: "internal" }, 500);
    }
  };
}

/** Rejects cross-site form/fetch submissions that would ride on the session cookie. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin fetches from older browsers, or server-to-server (signed separately)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || new URL(origin).host !== host) throw new HttpError(403, "Cross-origin request blocked.", "bad_origin");
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.", "invalid_json");
  }
}

/** Tiny fixed-window rate limiter. Per server instance — put a shared store in front for multi-instance deploys. */
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return;
  }
  if (++b.count > limit) throw new HttpError(429, "Too many requests. Please slow down.", "rate_limited");
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
