import { NextResponse } from "next/server";
import { limited, originOf, problem, readJson } from "@/lib/server/http";
import { prepareOnChain } from "@/lib/server/launches";

export const dynamic = "force-dynamic";

/** Build the unsigned Pump.fun create transaction for { creator, mint }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = limited(req, "prepare", 10);
  if (blocked) return blocked;
  const body = await readJson(req, 2_000);
  if (body instanceof Response) return body;
  const { id } = await params;
  const r = await prepareOnChain(id, (body ?? {}) as { creator?: unknown; mint?: unknown }, originOf(req));
  return r.ok ? NextResponse.json({ transaction: r.transaction, mint: r.mint }) : problem(r.status, r.error);
}
