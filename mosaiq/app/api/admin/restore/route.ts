import { NextResponse } from "next/server";
import { authorized } from "@/lib/server/admin";
import { problem, readJson } from "@/lib/server/http";
import { restoreLaunch } from "@/lib/server/launches";

export const dynamic = "force-dynamic";

/**
 * Put back a launch that is live on-chain but missing from the ledger (for
 * example one lost before the store was persistent). Admin only, and the
 * creation transaction is still verified on-chain before anything is written.
 */
export async function POST(req: Request) {
  if (!authorized(req)) return problem(401, "Unauthorized.");
  const body = await readJson(req);
  if (body instanceof Response) return body;
  const r = await restoreLaunch(body as Record<string, unknown>);
  return r.ok ? NextResponse.json({ id: r.launch.id, address: r.launch.address, status: r.launch.status }) : problem(r.status, r.error);
}
