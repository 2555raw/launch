import { NextResponse } from "next/server";
import { limited, originOf, problem, readJson } from "@/lib/server/http";
import { preparedForClient, prepareOnChain } from "@/lib/server/launches";

export const dynamic = "force-dynamic";

/** Build the unsigned create transaction(s) for { creator, mint? } on the draft's pad. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = limited(req, "prepare", 15);
  if (blocked) return blocked;
  const body = await readJson(req, 2_000);
  if (body instanceof Response) return body;
  const { id } = await params;
  const r = await prepareOnChain(id, (body ?? {}) as { creator?: unknown; mint?: unknown; signature?: unknown }, { origin: originOf(req) });
  return r.ok ? NextResponse.json(preparedForClient(r.prepared)) : problem(r.status, r.error);
}
