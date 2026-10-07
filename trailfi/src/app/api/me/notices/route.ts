import { z } from "zod";
import { json, readJson, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { referralInfo } from "@/lib/services/referrals";
import { markNoticesSeen, unseenNotices } from "@/lib/services/notices";

export const dynamic = "force-dynamic";

/** What changed since the walker last looked: reviewed uploads and payouts that landed. */
export const GET = route(async () => {
  const me = await requireUser();
  const [notices, referral] = await Promise.all([unseenNotices(me.id), referralInfo(me.id)]);
  return json({ notices, referralCode: referral.code });
});

/** Marks the shown notices as seen. */
export const POST = route(async (req) => {
  const me = await requireUser();
  const body = z.object({ entries: z.array(z.string()).default([]), payouts: z.array(z.string()).default([]) }).parse(await readJson(req));
  await markNoticesSeen(me.id, body.entries, body.payouts);
  return json({ ok: true });
});
