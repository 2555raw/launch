import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authenticate, apiError, readJson } from "@/lib/api/auth";
import { refundPayment, serialiseTransaction } from "@/lib/services/merchants";
import { getTransaction } from "@/lib/services/ledger";
import { parseAmount } from "@/lib/money";
import { asset, type AssetId } from "@/lib/assets";
import { audit } from "@/lib/services/audit";
import { drainDeliveries } from "@/lib/services/webhooks";
import { token } from "@/lib/ids";

export const dynamic = "force-dynamic";

const schema = z.object({
  transaction_id: z.string().min(4),
  amount: z.union([z.string(), z.number()]).optional(),
  reason: z.string().max(140).optional(),
});

const STATUS: Record<string, number> = { NOT_FOUND: 404, INVALID: 400, INSUFFICIENT_FUNDS: 402 };

/** POST /v1/refunds — return all or part of a payment to the customer. */
export async function POST(request: NextRequest) {
  const auth = authenticate(request);
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  if (body instanceof NextResponse) return body;

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return apiError(400, "invalid_parameter", `${issue.path.join(".") || "body"}: ${issue.message}`);
  }

  const original = getTransaction(parsed.data.transaction_id);
  if (!original) return apiError(404, "not_found", "No transaction with that id.");

  let amount: bigint | undefined;
  if (parsed.data.amount !== undefined) {
    try {
      amount = parseAmount(String(parsed.data.amount), asset(original.asset as AssetId).decimals);
    } catch (e) {
      return apiError(400, "invalid_amount", e instanceof Error ? e.message : "Invalid amount.");
    }
  }

  const result = await refundPayment({
    merchant: auth.merchant,
    transactionId: parsed.data.transaction_id,
    amount,
    reason: parsed.data.reason,
    // The header makes a retry safe; without one every call is a new refund.
    idempotencyKey: request.headers.get("idempotency-key") ?? `refund:${token(12)}`,
  });
  if (!result.ok) return apiError(STATUS[result.code] ?? 400, result.code.toLowerCase(), result.message);

  audit({ type: "api_key", id: auth.key.id }, "api.refund.created", { type: "transaction", id: result.transaction.id });
  void drainDeliveries(5).catch(() => undefined);
  return NextResponse.json(serialiseTransaction(result.transaction), { status: 201 });
}
