import { NextResponse } from "next/server";
import { agentFromRequest } from "@/lib/server/agents";
import { limited, problem, readJson } from "@/lib/server/http";
import { confirmOnChain, toPublic } from "@/lib/server/launches";

export const dynamic = "force-dynamic";

/** Check the launch transaction on Solana; returns pending, live or failed. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = limited(req, "confirm", 60);
  if (blocked) return blocked;
  const body = await readJson(req, 2_000);
  if (body instanceof Response) return body;
  const { id } = await params;
  const r = await confirmOnChain(id, (body as { signature?: unknown } | null)?.signature, await agentFromRequest(req));
  if (!r.ok) return problem(r.status, r.error);
  const { image: _image, preparedHash: _hash, ...launch } = toPublic(r.launch);
  return NextResponse.json({ state: r.state, launch });
}
