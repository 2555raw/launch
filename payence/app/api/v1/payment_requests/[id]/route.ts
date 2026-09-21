import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { authenticate, apiError } from "@/lib/api/auth";
import { getPaymentRequest, serialisePaymentRequest, effectiveStatus } from "@/lib/services/merchants";
import { getDb, schema } from "@/lib/db";
import { audit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

/** GET /v1/payment_requests/:id — by id or by short code. */
export function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = authenticate(request);
  if (auth instanceof NextResponse) return auth;

  const pr = getPaymentRequest(params.id);
  if (!pr || pr.merchantId !== auth.merchant.id) {
    return apiError(404, "not_found", "No payment request with that id on this account.");
  }
  return NextResponse.json(serialisePaymentRequest(pr, auth.merchant));
}

/** DELETE /v1/payment_requests/:id — cancel one that has not been paid. */
export function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = authenticate(request);
  if (auth instanceof NextResponse) return auth;

  const pr = getPaymentRequest(params.id);
  if (!pr || pr.merchantId !== auth.merchant.id) {
    return apiError(404, "not_found", "No payment request with that id on this account.");
  }
  if (effectiveStatus(pr) === "paid") {
    return apiError(409, "already_paid", "A paid request cannot be cancelled. Refund the payment instead.");
  }
  getDb()
    .update(schema.paymentRequests)
    .set({ status: "cancelled", updatedAt: Date.now() })
    .where(eq(schema.paymentRequests.id, pr.id))
    .run();
  audit({ type: "api_key", id: auth.key.id }, "api.payment_request.cancelled", { type: "payment_request", id: pr.id });
  return NextResponse.json(serialisePaymentRequest(getPaymentRequest(pr.id)!, auth.merchant));
}
