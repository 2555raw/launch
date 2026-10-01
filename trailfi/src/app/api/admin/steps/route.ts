import { json, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/guard";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Review queue: unverified and flagged entries, newest first. */
export const GET = route(async () => {
  await requireAdmin();
  const entries = await query(
    `select s.id, s.user_id as "userId", u.short_id as "userShortId", u.wallet_address as "walletAddress",
       s.day::text as day, s.steps, s.source, s.verification, s.flags, s.proof_image is not null as "hasProof",
       s.created_at as "createdAt"
     from step_entries s join users u on u.id = s.user_id
     where s.verification in ('unverified', 'flagged')
     order by s.day desc, s.created_at desc limit 200`,
  );
  return json({ entries });
});
