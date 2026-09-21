import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticate, apiError, readJson } from "@/lib/api/auth";
import { createPaymentRequest, listPaymentRequests, serialisePaymentRequest, effectiveStatus } from "@/lib/services/merchants";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { isAssetId, isFiat, asset, type AssetId } from "@/lib/assets";
import { parseAmount } from "@/lib/money";
import { audit } from "@/lib/services/audit";
import { drainDeliveries } from "@/lib/services/webhooks";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  amount: z.union([z.string(), z.number()]),
  currency: z.string(),
  description: z.string().max(140).optional(),
  reference: z.string().max(60).optional(),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
  reusable: z.boolean().optional(),
  expires_in_minutes: z.number().int().min(1).max(20160).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** POST /v1/payment_requests — create a charge the customer can pay. */
export async function POST(request: NextRequest) {
  const auth = authenticate(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return apiError(400, "invalid_parameter", `${issue.path.join(".") || "body"}: ${issue.message}`);
  }
  const { currency } = parsed.data;
  if (!isFiat(currency) && !isAssetId(currency)) {
    return apiError(400, "unsupported_currency", `${currency} is not a supported currency or asset.`);
  }

  let amount: bigint;
  try {
    amount = parseAmount(
      String(parsed.data.amount),
      isAssetId(currency) ? asset(currency as AssetId).decimals : 2
    );
  } catch (e) {
    return apiError(400, "invalid_amount", e instanceof Error ? e.message : "Invalid amount.");
  }
  if (amount <= 0n) return apiError(400, "invalid_amount", "Amount must be greater than zero.");

  // An Idempotency-Key replays the original response rather than charging twice.
  const idem = request.headers.get("idempotency-key");
  if (idem) {
    const existing = getDb()
      .select()
      .from(schema.paymentRequests)
      .where(and(eq(schema.paymentRequests.merchantId, auth.merchant.id), eq(schema.paymentRequests.reference, idem)))
      .get();
    if (existing) {
      return NextResponse.json(serialisePaymentRequest(existing, auth.merchant), { status: 200 });
    }
  }

  const pr = createPaymentRequest({
    merchant: auth.merchant,
    kind: "checkout",
    priceCurrency: currency,
    priceAmount: amount,
    description: parsed.data.description,
    reference: parsed.data.reference ?? idem ?? undefined,
    successUrl: parsed.data.success_url,
    cancelUrl: parsed.data.cancel_url,
    reusable: parsed.data.reusable,
    ttlMs: (parsed.data.expires_in_minutes ?? 30) * 60_000,
    metadata: parsed.data.metadata,
  });

  audit({ type: "api_key", id: auth.key.id }, "api.payment_request.created", { type: "payment_request", id: pr.id });
  void drainDeliveries(5).catch(() => undefined);

  return NextResponse.json(serialisePaymentRequest(pr, auth.merchant), { status: 201 });
}

/** GET /v1/payment_requests — list the merchant's charges, newest first. */
export async function GET(request: NextRequest) {
  const auth = authenticate(request);
  if (auth instanceof NextResponse) return auth;

  const limit = Math.min(100, Number(request.nextUrl.searchParams.get("limit") ?? "25") || 25);
  const status = request.nextUrl.searchParams.get("status");
  const items = listPaymentRequests(auth.merchant.id, limit)
    .filter((pr) => !status || effectiveStatus(pr) === status)
    .map((pr) => serialisePaymentRequest(pr, auth.merchant));

  return NextResponse.json({ object: "list", data: items, has_more: items.length === limit });
}
