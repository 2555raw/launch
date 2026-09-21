import { NextResponse, type NextRequest } from "next/server";
import { authenticate, apiError } from "@/lib/api/auth";
import { getTransaction } from "@/lib/services/ledger";
import { serialiseTransaction } from "@/lib/services/merchants";

export const dynamic = "force-dynamic";

/** GET /v1/transactions/:id — a payment or refund on this merchant account. */
export function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = authenticate(request);
  if (auth instanceof NextResponse) return auth;

  const tx = getTransaction(params.id);
  const mine = tx && (tx.toId === auth.merchant.id || tx.fromId === auth.merchant.id);
  if (!tx || !mine) return apiError(404, "not_found", "No transaction with that id on this account.");
  return NextResponse.json(serialiseTransaction(tx));
}
