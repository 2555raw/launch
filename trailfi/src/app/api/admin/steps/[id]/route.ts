import { z } from "zod";
import { json, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { getStepProof, reviewStepEntry } from "@/lib/services/steps";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** The screenshot the walker attached to this entry. */
export const GET = route<Ctx>(async (_req, ctx) => {
  await requireAdmin();
  const entryId = z.string().uuid().parse((await ctx.params).id);
  return json({ proof: await getStepProof(entryId) });
});

/** Manual review of a step entry: the only path from "unverified" to payable. */
export const PATCH = route<Ctx>(async (req, ctx) => {
  const admin = await requireAdmin();
  const entryId = z.string().uuid().parse((await ctx.params).id);
  return json({ entry: await reviewStepEntry(entryId, await readJson(req), admin.wallet_address) });
});
