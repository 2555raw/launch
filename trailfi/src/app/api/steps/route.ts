import { json, rateLimit, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { stepEarnings } from "@/lib/services/earnings";
import { ensureReferralCode } from "@/lib/services/referrals";
import { submitManualSteps } from "@/lib/services/steps";

export const dynamic = "force-dynamic";

/** The walker's uploaded days, each with its estimated amount, plus their averages. */
export const GET = route(async () => {
  const me = await requireUser();
  const [earnings, referralCode] = await Promise.all([stepEarnings(me.id), ensureReferralCode(me.id)]);
  return json({ ...earnings, referralCode });
});

/** Upload from the browser with a screenshot. Stored unverified — never payable without admin review. */
export const POST = route(async (req) => {
  const me = await requireUser();
  rateLimit(`steps:${me.id}`, 10, 60_000);
  const entry = await submitManualSteps(me.id, await readJson(req));
  const { steps } = await stepEarnings(me.id);
  return json({ entry: steps.find((s) => s.id === entry.id) ?? { ...entry, estimate: 0 } }, 201);
});
