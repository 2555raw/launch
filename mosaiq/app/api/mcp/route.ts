import { NextResponse } from "next/server";
import { agentFromRequest } from "@/lib/server/agents";
import { limited, originOf, readJson } from "@/lib/server/http";
import { handleRpc, PROTOCOL_VERSION, tools } from "@/lib/server/mcp";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    name: `${site.name} MCP`,
    transport: "JSON-RPC 2.0 over HTTP POST",
    protocolVersion: PROTOCOL_VERSION,
    auth: `Authorization: Bearer ${site.keyPrefix}… (needed for submit_launch)`,
    tools: tools.map((t) => ({ name: t.name, description: t.description })),
  });
}

export async function POST(req: Request) {
  const blocked = limited(req, "mcp", 120);
  if (blocked) return blocked;
  const body = await readJson(req);
  if (body instanceof Response) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const ctx = { agent: await agentFromRequest(req), origin: originOf(req) };
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleRpc(m, ctx)))).filter(Boolean);
    return out.length ? NextResponse.json(out) : new Response(null, { status: 202 });
  }
  const out = await handleRpc(body as Parameters<typeof handleRpc>[0], ctx);
  return out ? NextResponse.json(out) : new Response(null, { status: 202 });
}
