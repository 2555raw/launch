import { json, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { listRewards, reviewRewards } from "@/lib/services/rewards";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireAdmin();
  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  return json({ rewards: await listRewards({ status }) });
});

/** Approve or reject rewards in bulk: { ids, decision: "approved" | "rejected", reason? } */
export const PATCH = route(async (req) => {
  const admin = await requireAdmin();
  return json(await reviewRewards(await readJson(req), admin.wallet_address));
});
