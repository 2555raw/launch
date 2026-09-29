import { NextResponse } from "next/server";
import { buildHandoff, studioUrl } from "@/lib/handoff";
import { limited, originOf, problem, readJson } from "@/lib/server/http";
import { createDraft } from "@/lib/server/launches";

export const dynamic = "force-dynamic";

/** Save a studio draft. People can draft; submitting is an agent's job (see /api/mcp). */
export async function POST(req: Request) {
  const blocked = limited(req, "drafts", 20);
  if (blocked) return blocked;
  const body = await readJson(req);
  if (body instanceof Response) return body;

  const result = await createDraft(body);
  if (!result.ok) return problem(422, "Some fields need attention.", { fields: result.errors });

  const l = result.launch;
  const origin = originOf(req);
  return NextResponse.json(
    {
      id: l.id,
      url: studioUrl(origin, l, l.id),
      handoff: buildHandoff({ ...l, hasImage: Boolean(l.image) }, origin, l.id),
    },
    { status: 201 },
  );
}
