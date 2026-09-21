import { eq, and, lte, or, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { id, token } from "@/lib/ids";
import { hmac, safeEqual } from "@/lib/auth/crypto";

/**
 * Merchant webhooks.
 *
 * Signature: `t=<unix seconds>,v1=<hex hmac-sha256 of "t.body">`, the scheme
 * Stripe popularised, because it is replay-resistant: the timestamp is signed,
 * so a captured delivery cannot be replayed outside the tolerance window.
 */
const TOLERANCE_SECONDS = 300;

export function signPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${hmac(secret, `${timestamp}.${body}`)}`;
}

export function verifySignature(secret: string, body: string, header: string, now = Date.now()): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > TOLERANCE_SECONDS) return false;
  return safeEqual(parts.v1 ?? "", hmac(secret, `${t}.${body}`));
}

export function createEndpoint(merchantId: string, url: string) {
  const row = {
    id: id("whe"),
    merchantId,
    url,
    secret: `whsec_${token(24)}`,
    active: true,
    createdAt: Date.now(),
  };
  getDb().insert(schema.webhookEndpoints).values(row).run();
  return row;
}

export type WebhookEvent =
  | "payment.completed"
  | "payment.failed"
  | "payment.expired"
  | "payment_request.created"
  | "refund.completed";

/** Queue a delivery for every active endpoint the merchant has. */
export function emit(merchantId: string, event: WebhookEvent, data: Record<string, unknown>) {
  const db = getDb();
  const endpoints = db
    .select()
    .from(schema.webhookEndpoints)
    .where(and(eq(schema.webhookEndpoints.merchantId, merchantId), eq(schema.webhookEndpoints.active, true)))
    .all();
  const payload = JSON.stringify({ id: id("evt"), type: event, created: Math.floor(Date.now() / 1000), data });
  for (const endpoint of endpoints) {
    db.insert(schema.webhookDeliveries)
      .values({
        id: id("whd"),
        endpointId: endpoint.id,
        event,
        payload,
        status: "pending",
        attempts: 0,
        nextAttemptAt: Date.now(),
        createdAt: Date.now(),
      })
      .run();
  }
}

const BACKOFF_MS = [0, 30_000, 2 * 60_000, 10 * 60_000, 60 * 60_000, 6 * 60 * 60_000];

/**
 * Deliver what is due. Called opportunistically from request handlers; in
 * production this is a worker (a queue consumer or a cron job) so delivery does
 * not ride on user traffic.
 */
export async function drainDeliveries(limit = 10): Promise<{ delivered: number; failed: number }> {
  const db = getDb();
  const due = db
    .select()
    .from(schema.webhookDeliveries)
    .where(
      and(
        eq(schema.webhookDeliveries.status, "pending"),
        or(isNull(schema.webhookDeliveries.nextAttemptAt), lte(schema.webhookDeliveries.nextAttemptAt, Date.now()))
      )
    )
    .limit(limit)
    .all();

  let delivered = 0;
  let failed = 0;
  for (const d of due) {
    const endpoint = db.select().from(schema.webhookEndpoints).where(eq(schema.webhookEndpoints.id, d.endpointId)).get();
    if (!endpoint) continue;
    const attempts = d.attempts + 1;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Payence-Signature": signPayload(endpoint.secret, d.payload),
          "Payence-Event": d.event,
          "Payence-Delivery": d.id,
        },
        body: d.payload,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        db.update(schema.webhookDeliveries)
          .set({ status: "delivered", attempts, lastResponseCode: res.status, nextAttemptAt: null })
          .where(eq(schema.webhookDeliveries.id, d.id))
          .run();
        delivered++;
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      failed++;
      const exhausted = attempts >= BACKOFF_MS.length;
      db.update(schema.webhookDeliveries)
        .set({
          status: exhausted ? "failed" : "pending",
          attempts,
          nextAttemptAt: exhausted ? null : Date.now() + BACKOFF_MS[attempts],
          lastError: err instanceof Error ? err.message.slice(0, 200) : "unknown",
        })
        .where(eq(schema.webhookDeliveries.id, d.id))
        .run();
    }
  }
  return { delivered, failed };
}
