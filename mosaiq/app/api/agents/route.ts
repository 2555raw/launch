import { NextResponse } from "next/server";
import { agentInputSchema, fieldErrors } from "@/lib/schemas";
import { createAgent } from "@/lib/server/agents";
import { limited, problem, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Issue an agent key. The key is in this response and nowhere else. */
export async function POST(req: Request) {
  const blocked = limited(req, "agents", 5, 10 * 60_000);
  if (blocked) return blocked;
  const body = await readJson(req, 2_000);
  if (body instanceof Response) return body;
  const parsed = agentInputSchema.safeParse(body);
  if (!parsed.success) return problem(422, "Check the agent name.", { fields: fieldErrors(parsed.error) });
  const { agent, key } = await createAgent(parsed.data.name);
  return NextResponse.json({ agent, key }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
