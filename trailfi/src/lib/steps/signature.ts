import { createHmac, timingSafeEqual } from "node:crypto";

/** Max clock skew accepted for a signed ingest request. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Signature scheme for /api/steps/ingest:
 *   x-trailfi-timestamp: unix seconds
 *   x-trailfi-signature: sha256=<hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`)>
 */
export function signIngestPayload(secret: string, timestamp: number, rawBody: string): string {
  return "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifyIngestSignature(opts: {
  secret: string;
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  now?: number;
}): { ok: true } | { ok: false; error: string } {
  if (!opts.secret) return { ok: false, error: "Ingestion is not configured (STEP_INGEST_SECRET missing)." };
  if (!opts.timestamp || !opts.signature) return { ok: false, error: "Missing signature headers." };
  const ts = Number(opts.timestamp);
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (!Number.isInteger(ts) || Math.abs(now - ts) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, error: "Signature timestamp outside the accepted window." };
  }
  const expected = Buffer.from(signIngestPayload(opts.secret, ts, opts.rawBody));
  const given = Buffer.from(opts.signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, error: "Invalid signature." };
  }
  return { ok: true };
}
