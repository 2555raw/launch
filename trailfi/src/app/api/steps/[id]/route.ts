import { z } from "zod";
import { json, rateLimit, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { deleteOwnUpload } from "@/lib/services/steps";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Deletes one of the walker's own uploads while it is still waiting for review. */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const me = await requireUser();
  rateLimit(`steps-delete:${me.id}`, 10, 60 * 60_000);
  const entryId = z.string().uuid().parse((await ctx.params).id);
  return json({ deleted: await deleteOwnUpload(me.id, me.wallet_address, entryId) });
});
