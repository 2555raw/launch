import { json, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { query } from "@/lib/db";
import { tierReward } from "@/lib/rewards/engine";
import { readPendingScreenshots } from "@/lib/services/screenshotReader";
import { getSettings, toTiers } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

/**
 * Review queue: unverified and flagged entries, newest first. Each one carries
 * what verifying it would pay under the current rates, plus whether it would
 * also release the referral bonus, and the earlier upload its photo matches.
 */
export const GET = route(async () => {
  await requireAdmin();
  const [rows, settings] = await Promise.all([
    query<{ steps: number; firstReferred: boolean }>(
      `select s.id, s.user_id as "userId", u.short_id as "userShortId", u.wallet_address as "walletAddress",
         s.day::text as day, s.steps, s.source, s.verification, s.flags, s.proof_image is not null as "hasProof",
         s.created_at as "createdAt", s.ocr_status as "ocrStatus", s.ocr_steps as "ocrSteps", s.ocr_day::text as "ocrDay", s.ocr_note as "ocrNote",
         (u.referred_by is not null and u.referral_rewarded_at is null) as "firstReferred",
         case when m.id is null then null else json_build_object(
           'id', m.id, 'day', m.day::text, 'steps', m.steps, 'verification', m.verification,
           'userShortId', mu.short_id, 'sameWalker', m.user_id = s.user_id, 'exact', m.proof_sha = s.proof_sha
         ) end as "photoMatch"
       from step_entries s join users u on u.id = s.user_id
       left join step_entries m on m.id = s.proof_match
       left join users mu on mu.id = m.user_id
       where s.verification in ('unverified', 'flagged')
       order by s.day desc, s.created_at desc limit 200`,
    ),
    getSettings(),
  ]);
  // Catch up on uploads that were never read (for example after a restart), in the background.
  void readPendingScreenshots();
  const tiers = toTiers(settings);
  const entries = rows.map((r) => ({
    ...r,
    payout: tierReward(r.steps, tiers),
    referralBonus: r.firstReferred ? settings.referralBonus : 0,
  }));
  return json({ entries, tokenSymbol: settings.payoutTokenSymbol });
});
