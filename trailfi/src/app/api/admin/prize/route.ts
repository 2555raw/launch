import { json, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { awardLastWeekPrize, lastWeekPrize } from "@/lib/services/ranking";

export const dynamic = "force-dynamic";

/** Last week's #1 walker and whether the weekly prize was credited. Admins only. */
export const GET = route(async () => {
  await requireAdmin();
  return json(await lastWeekPrize());
});

/** Credits last week's prize to the winner as an approved reward, ready to pay. */
export const POST = route(async () => {
  const admin = await requireAdmin();
  return json(await awardLastWeekPrize(admin.wallet_address));
});
