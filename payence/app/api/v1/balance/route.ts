import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { getBalances } from "@/lib/services/ledger";
import { acceptedAssets } from "@/lib/services/merchants";

export const dynamic = "force-dynamic";

/** GET /v1/balance — the merchant's settled and pending balance per asset. */
export function GET(request: NextRequest) {
  const auth = authenticate(request);
  if (auth instanceof NextResponse) return auth;

  const balances = getBalances({ type: "merchant", id: auth.merchant.id });
  return NextResponse.json({
    object: "balance",
    merchant: { id: auth.merchant.id, name: auth.merchant.name, status: auth.merchant.status },
    settlement_asset: auth.merchant.settlementAsset,
    accepted_assets: acceptedAssets(auth.merchant),
    balances: balances.map((b) => ({ asset: b.asset, available: b.available.toString(), pending: b.pending.toString() })),
  });
}
