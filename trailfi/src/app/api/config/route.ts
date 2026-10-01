import { json, route } from "@/lib/api";
import { getSettings } from "@/lib/services/settings";
import { STEP_PROVIDERS } from "@/lib/steps/providers";

export const dynamic = "force-dynamic";

/** Public settings: the daily goal, the payout token and the step sources. */
export const GET = route(async () => {
  const s = await getSettings();
  // Reward rates are private: only the daily goal and the payout token are public.
  return json({
    dailyStepGoal: s.dailyStepGoal,
    payoutTokenSymbol: s.payoutTokenSymbol,
    providers: Object.values(STEP_PROVIDERS),
  });
});
