import { z } from "zod";
import { HttpError, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { getStepProof } from "@/lib/services/steps";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** The walker's screenshot as an image, so the review queue can show it inline. */
export const GET = route<Ctx>(async (_req, ctx) => {
  await requireAdmin();
  const entryId = z.string().uuid().parse((await ctx.params).id);
  const proof = await getStepProof(entryId);
  const match = proof?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new HttpError(404, "No screenshot attached.", "no_proof");
  return new Response(Buffer.from(match[2], "base64"), {
    headers: { "content-type": match[1], "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" },
  });
});
