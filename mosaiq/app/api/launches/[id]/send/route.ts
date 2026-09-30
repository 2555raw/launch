import { NextResponse } from "next/server";
import { limited, problem, readJson } from "@/lib/server/http";
import { relayOnChain } from "@/lib/server/launches";

export const dynamic = "force-dynamic";

/** Relay the signed transaction to Solana. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = limited(req, "send", 10);
  if (blocked) return blocked;
  const body = await readJson(req, 8_000);
  if (body instanceof Response) return body;
  const { id } = await params;
  const r = await relayOnChain(id, (body as { transaction?: unknown } | null)?.transaction);
  return r.ok ? NextResponse.json({ signature: r.signature }) : problem(r.status, r.error);
}
