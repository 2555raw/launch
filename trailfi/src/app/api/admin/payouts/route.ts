import { z } from "zod";
import { json, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { listPayouts, preparePayout } from "@/lib/services/payouts";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireAdmin();
  const status = new URL(req.url).searchParams.get("status") ?? "all";
  return json({ payouts: await listPayouts({ status, limit: 200 }) });
});

/** Prepares (does not send) a payout of a user's approved rewards. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const { userId } = z.object({ userId: z.string().uuid() }).parse(await readJson(req));
  return json({ payout: await preparePayout(userId, admin.wallet_address) }, 201);
});
