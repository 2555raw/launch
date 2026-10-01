import { json, route, serialize } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { listPayouts } from "@/lib/services/payouts";
import { estimateToday, listRewards, rewardSummary } from "@/lib/services/rewards";
import { getSettings } from "@/lib/services/settings";
import { listUserSteps } from "@/lib/services/steps";
import { referralInfo } from "@/lib/services/referrals";
import { getUser } from "@/lib/services/users";

export const dynamic = "force-dynamic";

/** Everything the private dashboard shows, for the signed-in wallet only. */
export const GET = route(async () => {
  const me = await requireUser();
  const [user, settings, today, summary, steps, rewards, payouts, referral] = await Promise.all([
    getUser(me.id),
    getSettings(),
    estimateToday(me.id),
    rewardSummary(me.id),
    listUserSteps(me.id, 30),
    listRewards({ userId: me.id, status: "all", limit: 50 }),
    listPayouts({ userId: me.id, limit: 50 }),
    referralInfo(me.id),
  ]);
  return json(
    serialize({
      user,
      settings: {
        dailyStepGoal: settings.dailyStepGoal,
        payoutTokenSymbol: settings.payoutTokenSymbol,
        referralBonus: settings.referralBonus,
      },
      referral,
      today,
      summary,
      steps,
      rewards,
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        tokenSymbol: p.tokenSymbol,
        chainId: p.chainId,
        status: p.status,
        simulated: p.simulated,
        txHash: p.txHash,
        steps: p.steps,
        createdAt: p.createdAt,
        confirmedAt: p.confirmedAt,
      })),
    }),
  );
});
