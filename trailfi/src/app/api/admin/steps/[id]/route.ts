import { z } from "zod";
import { json, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { reviewStepEntry } from "@/lib/services/steps";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Manual review of a step entry: the only path from "unverified" to payable. */
export const PATCH = route<Ctx>(async (req, ctx) => {
  const admin = await requireAdmin();
  const entryId = z.string().uuid().parse((await ctx.params).id);
  return json({ entry: await reviewStepEntry(entryId, await readJson(req), admin.wallet_address) });
});
