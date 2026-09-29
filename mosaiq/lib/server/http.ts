import "server-only";
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "./rate-limit";

export function originOf(req: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

export function problem(status: number, message: string, extra: Record<string, unknown> = {}, headers?: HeadersInit) {
  return NextResponse.json({ error: message, ...extra }, { status, headers });
}

/** Parse a JSON body with a size cap; returns a Response on failure. */
export async function readJson(req: Request, maxBytes = 600_000): Promise<unknown | Response> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > maxBytes) return problem(413, "Request body is too large.");
  const raw = await req.text();
  if (raw.length > maxBytes) return problem(413, "Request body is too large.");
  try {
    return JSON.parse(raw);
  } catch {
    return problem(400, "Body must be JSON.");
  }
}

export function limited(req: Request, bucket: string, limit: number, windowMs = 60_000): Response | null {
  const r = rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs);
  return r.ok ? null : problem(429, "Too many requests. Try again shortly.", {}, { "Retry-After": String(r.retryAfter) });
}
