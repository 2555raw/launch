import { json, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { query } from "@/lib/db";
import { tierReward } from "@/lib/rewards/engine";
import { getSettings, toTiers } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

/**
 * Review queue: unverified and flagged entries, newest first. Each one carries
 * what verifying it would pay under the current rates, plus whether it would
 * also release the referral bonus.
 */
export const GET = route(async () => {
  await requireAdmin();
  const [rows, settings] = await Promise.all([
    query<{ steps: number; firstReferred: boolean }>(
      `select s.id, s.user_id as "userId", u.short_id as "userShortId", u.wallet_address as "walletAddress",
         s.day::text as day, s.steps, s.source, s.verification, s.flags, s.proof_image is not null as "hasProof",
         s.created_at as "createdAt",
         (u.referred_by is not null and u.referral_rewarded_at is null) as "firstReferred"
       from step_entries s join users u on u.id = s.user_id
       where s.verification in ('unverified', 'flagged')
       order by s.day desc, s.created_at desc limit 200`,
    ),
    getSettings(),
  ]);
  const tiers = toTiers(settings);
  const entries = rows.map((r) => ({
    ...r,
    payout: tierReward(r.steps, tiers),
    referralBonus: r.firstReferred ? settings.referralBonus : 0,
  }));
  return json({ entries, tokenSymbol: settings.payoutTokenSymbol });
});
