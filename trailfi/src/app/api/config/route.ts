import { json, route } from "@/lib/api";
import { getSettings } from "@/lib/services/settings";
import { STEP_PROVIDERS } from "@/lib/steps/providers";

export const dynamic = "force-dynamic";

/** Public reward rules, so anyone can see how distribution works. */
export const GET = route(async () => {
  const s = await getSettings();
  return json({
    rewardPercent: s.rewardPercent,
    dailyStepGoal: s.dailyStepGoal,
    maxRewardPerUser: s.maxRewardPerUser,
    stepCapMultiplier: s.stepCapMultiplier,
    distributionFrequency: s.distributionFrequency,
    payoutTokenSymbol: s.payoutTokenSymbol,
    providers: Object.values(STEP_PROVIDERS),
  });
});
