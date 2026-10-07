import { z } from "zod";
import { json, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { cancelPayout, confirmOnChain, getPayout, markSubmitted, requotePayout, simulatePayout } from "@/lib/services/payouts";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();

export const GET = route<Ctx>(async (_req, ctx) => {
  await requireAdmin();
  return json({ payout: await getPayout(idSchema.parse((await ctx.params).id)) });
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit"), txHash: z.string(), from: z.string() }),
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("simulate") }),
  z.object({ action: z.literal("requote") }),
]);

/**
 * Payout state machine, driven by the admin UI:
 *   prepared → submit (tx hash from the admin's wallet) → confirm (server checks the chain)
 *   prepared | failed → cancel
 *   prepared → simulate (demo mode only)
 *   prepared → requote (native ETH only: new ETH amount for the same dollars at today's price)
 */
export const PATCH = route<Ctx>(async (req, ctx) => {
  const admin = await requireAdmin();
  const id = idSchema.parse((await ctx.params).id);
  const body = actionSchema.parse(await readJson(req));
  const actor = admin.wallet_address;
  switch (body.action) {
    case "submit":
      return json({ payout: await markSubmitted(id, body, actor) });
    case "confirm": {
      const result = await confirmOnChain(id, actor);
      return json(result, result.pending ? 202 : 200);
    }
    case "cancel":
      return json({ payout: await cancelPayout(id, actor) });
    case "simulate":
      return json({ payout: await simulatePayout(id, actor) });
    case "requote":
      return json({ payout: await requotePayout(id, actor) });
  }
});
