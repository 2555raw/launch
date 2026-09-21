import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { id, shortCode, token } from "@/lib/ids";
import { sha256 } from "@/lib/auth/crypto";
import { asset, type AssetId, type FiatCurrency, isAssetId, isFiat } from "@/lib/assets";
import { convert, feeOf, fromDb, toDb } from "@/lib/money";
import { FEES } from "./fees";
import { fiatRate } from "@/lib/providers/rates";
import { audit } from "./audit";
import { notify } from "./notifications";
import { emit } from "./webhooks";
import { LedgerError, PLATFORM_FEES, postTransaction, type Entry, type Owner } from "./ledger";
import { checkLimits } from "./limits";
import { compliance } from "@/lib/providers/compliance";
import { config } from "@/lib/config";

export type Failure = {
  ok: false;
  code: "NOT_FOUND" | "EXPIRED" | "ALREADY_PAID" | "INVALID" | "INSUFFICIENT_FUNDS" | "LIMIT" | "COMPLIANCE" | "SELF_PAYMENT" | "CANCELLED";
  message: string;
};
const fail = (code: Failure["code"], message: string): Failure => ({ ok: false, code, message });

const DEFAULT_TTL_MS = 30 * 60_000; // a payment request is good for 30 minutes

export function createMerchant(input: {
  ownerUserId: string;
  name: string;
  websiteUrl?: string;
  country?: string;
  settlementAsset?: AssetId;
  pricingCurrency?: FiatCurrency;
}) {
  const db = getDb();
  const base = slugify(input.name);
  let slug = base;
  let n = 1;
  while (db.select().from(schema.merchants).where(eq(schema.merchants.slug, slug)).get()) slug = `${base}-${++n}`;
  const now = Date.now();
  const row: typeof schema.merchants.$inferInsert = {
    id: id("mch"),
    ownerUserId: input.ownerUserId,
    name: input.name,
    slug,
    websiteUrl: input.websiteUrl,
    country: input.country,
    // Verification is a KYB process with a regulated provider; new merchants
    // start pending and are told what that means.
    status: "pending",
    settlementAsset: input.settlementAsset ?? "USDC",
    acceptedAssets: JSON.stringify(["USDC", "USDT", "EURC"]),
    pricingCurrency: input.pricingCurrency ?? "EUR",
    createdAt: now,
    updatedAt: now,
  };
  db.insert(schema.merchants).values(row).run();
  db.insert(schema.complianceReviews)
    .values({
      id: id("case"),
      subjectType: "merchant",
      subjectId: row.id,
      kind: "kyb",
      status: "open",
      reason: "New merchant awaiting business verification.",
      createdAt: now,
    })
    .run();
  audit({ type: "user", id: input.ownerUserId }, "merchant.created", { type: "merchant", id: row.id });
  return db.select().from(schema.merchants).where(eq(schema.merchants.id, row.id)).get()!;
}

export function acceptedAssets(m: schema.Merchant): AssetId[] {
  try {
    const parsed = JSON.parse(m.acceptedAssets) as string[];
    return parsed.filter(isAssetId);
  } catch {
    return ["USDC"];
  }
}

// --- API keys ----------------------------------------------------------------

/** The full key is returned once; only its hash is stored. */
export function createApiKey(merchantId: string, name: string, live = false) {
  const secret = `${live ? "pk_live" : "pk_test"}_${token(24)}`;
  const row = {
    id: id("key"),
    merchantId,
    name,
    prefix: secret.slice(0, 16),
    hash: sha256(secret),
    createdAt: Date.now(),
  };
  getDb().insert(schema.apiKeys).values(row).run();
  return { ...row, secret };
}

export function merchantForApiKey(secret: string): { merchant: schema.Merchant; key: schema.ApiKey } | null {
  const db = getDb();
  const key = db.select().from(schema.apiKeys).where(eq(schema.apiKeys.hash, sha256(secret))).get();
  if (!key || key.revokedAt) return null;
  const merchant = db.select().from(schema.merchants).where(eq(schema.merchants.id, key.merchantId)).get();
  if (!merchant || merchant.status === "suspended") return null;
  db.update(schema.apiKeys).set({ lastUsedAt: Date.now() }).where(eq(schema.apiKeys.id, key.id)).run();
  return { merchant, key };
}

// --- Payment requests --------------------------------------------------------

export function createPaymentRequest(input: {
  merchant: schema.Merchant;
  kind: "checkout" | "qr" | "link" | "pos";
  priceCurrency: string;
  priceAmount: bigint;
  description?: string;
  reference?: string;
  successUrl?: string;
  cancelUrl?: string;
  reusable?: boolean;
  ttlMs?: number;
  metadata?: Record<string, unknown>;
}) {
  const now = Date.now();
  const row: typeof schema.paymentRequests.$inferInsert = {
    id: id("pr"),
    code: shortCode(10),
    merchantId: input.merchant.id,
    kind: input.kind,
    status: "open",
    priceCurrency: input.priceCurrency,
    priceAmount: toDb(input.priceAmount),
    description: input.description,
    reference: input.reference,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    reusable: input.reusable ?? false,
    expiresAt: input.reusable ? null : now + (input.ttlMs ?? DEFAULT_TTL_MS),
    metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(schema.paymentRequests).values(row).run();
  const created = getPaymentRequest(row.id)!;
  emit(input.merchant.id, "payment_request.created", serialisePaymentRequest(created, input.merchant));
  return created;
}

export function getPaymentRequest(idOrCode: string): schema.PaymentRequest | undefined {
  const db = getDb();
  return (
    db.select().from(schema.paymentRequests).where(eq(schema.paymentRequests.id, idOrCode)).get() ??
    db.select().from(schema.paymentRequests).where(eq(schema.paymentRequests.code, idOrCode.toUpperCase())).get()
  );
}

export function merchantOf(merchantId: string): schema.Merchant | undefined {
  return getDb().select().from(schema.merchants).where(eq(schema.merchants.id, merchantId)).get();
}

/** Expiry is evaluated on read: no scheduler needed for a request to lapse. */
export function effectiveStatus(pr: schema.PaymentRequest): schema.PaymentRequest["status"] {
  if (pr.status === "open" && pr.expiresAt && pr.expiresAt <= Date.now()) return "expired";
  return pr.status;
}

export async function quoteForRequest(pr: schema.PaymentRequest, assetId: AssetId) {
  const a = asset(assetId);
  if (isAssetId(pr.priceCurrency)) {
    // Priced in an asset: convert through the pegs if the payer uses another.
    if (pr.priceCurrency === assetId) {
      return { amount: fromDb(pr.priceAmount), rate: "1", source: "peg", currency: pr.priceCurrency };
    }
    const q = await fiatRate(pr.priceCurrency as AssetId, a.peg);
    return {
      amount: convert(fromDb(pr.priceAmount), asset(pr.priceCurrency as AssetId).decimals, a.decimals, q.rate),
      rate: q.rate,
      source: q.source,
      currency: pr.priceCurrency,
    };
  }
  // Priced in fiat cents: invert the asset->fiat rate.
  const q = await fiatRate(assetId, pr.priceCurrency as FiatCurrency);
  const inverse = (1 / Number(q.rate)).toFixed(8);
  return { amount: convert(fromDb(pr.priceAmount), 2, a.decimals, inverse), rate: q.rate, source: q.source, currency: pr.priceCurrency };
}

/**
 * Pay a merchant from a user's Payence balance. The merchant is credited net of
 * the platform fee; the fee is posted to the platform's fee account, so the
 * books balance without a side channel.
 */
export async function payRequest(input: {
  user: schema.User;
  request: schema.PaymentRequest;
  assetId: AssetId;
  idempotencyKey: string;
}): Promise<{ ok: true; transaction: schema.Transaction } | Failure> {
  const db = getDb();
  const status = effectiveStatus(input.request);
  if (status === "expired") return fail("EXPIRED", "This payment request has expired. Ask the merchant for a new one.");
  if (status === "cancelled") return fail("CANCELLED", "This payment request was cancelled.");
  if (status === "paid" && !input.request.reusable) return fail("ALREADY_PAID", "This payment request has already been paid.");

  const merchant = merchantOf(input.request.merchantId);
  if (!merchant) return fail("NOT_FOUND", "That merchant is not available right now.");
  if (merchant.ownerUserId === input.user.id) return fail("SELF_PAYMENT", "You cannot pay your own merchant account.");
  if (!acceptedAssets(merchant).includes(input.assetId)) {
    return fail("INVALID", `${merchant.name} does not accept ${input.assetId}.`);
  }

  const quote = await quoteForRequest(input.request, input.assetId);
  if (quote.amount <= 0n) return fail("INVALID", "This payment request has no amount.");

  const currency = input.user.displayCurrency as FiatCurrency;
  const fiatQuote = await fiatRate(input.assetId, currency);
  const cents = convert(quote.amount, asset(input.assetId).decimals, 2, fiatQuote.rate);

  const limit = checkLimits(input.user, cents);
  if (!limit.ok) return fail("LIMIT", limit.message);

  const screen = await compliance().screenTransaction({
    userId: input.user.id,
    kind: "payment",
    fiatCents: cents,
    currency,
    counterparty: merchant.name,
  });
  if (screen.outcome === "block") return fail("COMPLIANCE", screen.reason);

  const payer: Owner = { type: "user", id: input.user.id };
  const payee: Owner = { type: "merchant", id: merchant.id };
  const fee = feeOf(quote.amount, FEES.merchantBps);
  const entries: Entry[] = [
    { owner: payer, asset: input.assetId, amount: -quote.amount, bucket: "available" },
    { owner: payee, asset: input.assetId, amount: quote.amount - fee, bucket: "available" },
  ];
  if (fee > 0n) entries.push({ owner: PLATFORM_FEES, asset: input.assetId, amount: fee, bucket: "available" });

  let tx: schema.Transaction;
  try {
    const posted = postTransaction(
      {
        type: "payment",
        status: "completed",
        asset: input.assetId,
        amount: quote.amount,
        fee,
        from: payer,
        to: payee,
        counterparty: merchant.name,
        reference: input.request.reference ?? input.request.description ?? undefined,
        fiatCurrency: currency,
        fiatAmount: cents,
        rate: fiatQuote.rate,
        idempotencyKey: input.idempotencyKey,
        paymentRequestId: input.request.id,
        metadata: { merchantSlug: merchant.slug, requestCode: input.request.code, priceCurrency: input.request.priceCurrency },
      },
      entries
    );
    tx = posted.tx;
    if (posted.replayed) return { ok: true, transaction: tx };
  } catch (err) {
    if (err instanceof LedgerError && err.code === "INSUFFICIENT_FUNDS") {
      return fail("INSUFFICIENT_FUNDS", `Not enough ${input.assetId} to complete this payment.`);
    }
    throw err;
  }

  db.update(schema.paymentRequests)
    .set({
      status: "paid",
      paidTransactionId: tx.id,
      payerUserId: input.user.id,
      updatedAt: Date.now(),
    })
    .where(eq(schema.paymentRequests.id, input.request.id))
    .run();

  audit({ type: "user", id: input.user.id }, "payment.completed", { type: "transaction", id: tx.id });
  notify(merchant.ownerUserId, {
    kind: "merchant",
    title: `Payment received`,
    body: `${input.user.name} paid ${input.request.description ?? "an invoice"}.`,
    href: `/merchant/transactions`,
  });
  emit(merchant.id, "payment.completed", {
    payment: serialiseTransaction(tx),
    payment_request: serialisePaymentRequest(getPaymentRequest(input.request.id)!, merchant),
  });
  return { ok: true, transaction: tx };
}

/** Refund all or part of a completed payment, back to the original payer. */
export async function refundPayment(input: {
  merchant: schema.Merchant;
  transactionId: string;
  amount?: bigint;
  reason?: string;
  idempotencyKey: string;
}): Promise<{ ok: true; transaction: schema.Transaction } | Failure> {
  const db = getDb();
  const original = db.select().from(schema.transactions).where(eq(schema.transactions.id, input.transactionId)).get();
  if (!original || original.toId !== input.merchant.id || original.type !== "payment") {
    return fail("NOT_FOUND", "That payment was not found on this merchant account.");
  }
  if (original.status !== "completed") return fail("INVALID", "Only a completed payment can be refunded.");

  const gross = fromDb(original.amount);
  const alreadyRefunded = db
    .select({ total: sql<string>`coalesce(sum(cast(${schema.transactions.amount} as integer)), 0)` })
    .from(schema.transactions)
    .where(and(eq(schema.transactions.type, "refund"), eq(schema.transactions.reference, original.id), eq(schema.transactions.status, "completed")))
    .get();
  const refunded = BigInt(alreadyRefunded?.total ?? "0");
  const amount = input.amount ?? gross - refunded;
  if (amount <= 0n) return fail("INVALID", "Enter a refund amount greater than zero.");
  if (refunded + amount > gross) return fail("INVALID", "That is more than the remaining refundable amount.");

  const assetId = original.asset as AssetId;
  const payer: Owner = { type: "user", id: original.fromId! };
  const payee: Owner = { type: "merchant", id: input.merchant.id };

  try {
    const { tx, replayed } = postTransaction(
      {
        type: "refund",
        status: "completed",
        asset: assetId,
        amount,
        from: payee,
        to: payer,
        counterparty: input.merchant.name,
        reference: original.id,
        fiatCurrency: original.fiatCurrency ?? undefined,
        idempotencyKey: input.idempotencyKey,
        paymentRequestId: original.paymentRequestId ?? undefined,
        metadata: { reason: input.reason, originalTransactionId: original.id },
      },
      [
        { owner: payee, asset: assetId, amount: -amount, bucket: "available" },
        { owner: payer, asset: assetId, amount, bucket: "available" },
      ]
    );
    if (!replayed) {
      if (original.paymentRequestId) {
        const total = refunded + amount;
        db.update(schema.paymentRequests)
          .set({ status: total >= gross ? "refunded" : "partially_refunded", refundedAmount: toDb(total), updatedAt: Date.now() })
          .where(eq(schema.paymentRequests.id, original.paymentRequestId))
          .run();
      }
      audit({ type: "merchant", id: input.merchant.id }, "refund.completed", { type: "transaction", id: tx.id });
      notify(payer.id, {
        kind: "payment",
        title: "Refund received",
        body: `${input.merchant.name} refunded you.`,
        href: `/transactions/${tx.id}`,
      });
      emit(input.merchant.id, "refund.completed", { refund: serialiseTransaction(tx), payment: serialiseTransaction(original) });
    }
    return { ok: true, transaction: tx };
  } catch (err) {
    if (err instanceof LedgerError && err.code === "INSUFFICIENT_FUNDS") {
      return fail("INSUFFICIENT_FUNDS", "This merchant balance cannot cover the refund.");
    }
    throw err;
  }
}

export function listPaymentRequests(merchantId: string, limit = 50) {
  return getDb()
    .select()
    .from(schema.paymentRequests)
    .where(eq(schema.paymentRequests.merchantId, merchantId))
    .orderBy(desc(schema.paymentRequests.createdAt))
    .limit(limit)
    .all();
}

/** Revenue and counts over a window, for the merchant dashboard. */
export function merchantStats(merchantId: string, sinceMs: number) {
  const t = schema.transactions;
  const rows = getDb()
    .select()
    .from(t)
    .where(and(eq(t.toType, "merchant"), eq(t.toId, merchantId), gte(t.createdAt, sinceMs)))
    .all();
  const refunds = getDb()
    .select()
    .from(t)
    .where(and(eq(t.fromType, "merchant"), eq(t.fromId, merchantId), eq(t.type, "refund"), gte(t.createdAt, sinceMs)))
    .all();
  const byAsset = new Map<AssetId, bigint>();
  let fees = 0n;
  let completed = 0;
  for (const r of rows) {
    if (r.type !== "payment" || r.status !== "completed") continue;
    completed++;
    const a = r.asset as AssetId;
    byAsset.set(a, (byAsset.get(a) ?? 0n) + fromDb(r.amount) - fromDb(r.fee));
    fees += fromDb(r.fee);
  }
  return {
    completed,
    refundCount: refunds.filter((r) => r.status === "completed").length,
    refundedByAsset: refunds.reduce((m, r) => {
      if (r.status !== "completed") return m;
      const a = r.asset as AssetId;
      m.set(a, (m.get(a) ?? 0n) + fromDb(r.amount));
      return m;
    }, new Map<AssetId, bigint>()),
    netByAsset: byAsset,
    fees,
  };
}

// --- API serialisation -------------------------------------------------------

export function serialisePaymentRequest(pr: schema.PaymentRequest, merchant: schema.Merchant) {
  return {
    id: pr.id,
    object: "payment_request",
    code: pr.code,
    status: effectiveStatus(pr),
    kind: pr.kind,
    price: { currency: pr.priceCurrency, amount: pr.priceAmount },
    description: pr.description,
    reference: pr.reference,
    merchant: { id: merchant.id, name: merchant.name, slug: merchant.slug },
    accepted_assets: acceptedAssets(merchant),
    checkout_url: `${config.appUrl}/checkout/${pr.code}`,
    expires_at: pr.expiresAt,
    paid_transaction_id: pr.paidTransactionId,
    refunded_amount: pr.refundedAmount,
    created_at: pr.createdAt,
  };
}

export function serialiseTransaction(tx: schema.Transaction) {
  return {
    id: tx.id,
    object: "transaction",
    type: tx.type,
    status: tx.status,
    asset: tx.asset,
    amount: tx.amount,
    fee: tx.fee,
    network: tx.network,
    tx_hash: tx.txHash,
    reference: tx.reference,
    fiat: tx.fiatCurrency ? { currency: tx.fiatCurrency, amount: tx.fiatAmount, rate: tx.rate } : null,
    payment_request_id: tx.paymentRequestId,
    created_at: tx.createdAt,
    completed_at: tx.completedAt,
  };
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "merchant";
}

export { isFiat };
