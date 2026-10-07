import "server-only";
import { randomInt } from "node:crypto";
import { one, query, type Queryable } from "@/lib/db";
import { env } from "@/lib/env";

// No 0/O or 1/I, so codes survive being read aloud or typed by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const REFERRAL_CODE_RE = /^[A-Z2-9]{7}$/;

function newCode() {
  return Array.from({ length: 7 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

/** The walker's referral code, created on first use. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const existing = await one<{ code: string | null }>("select referral_code as code from users where id = $1", [userId]);
  if (existing?.code) return existing.code;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const row = await one<{ code: string }>(
        "update users set referral_code = $2 where id = $1 and referral_code is null returning referral_code as code",
        [userId, newCode()],
      );
      if (row) return row.code;
      const again = await one<{ code: string | null }>("select referral_code as code from users where id = $1", [userId]);
      if (again?.code) return again.code;
    } catch {
      // Code already taken by someone else: try another one.
    }
  }
  throw new Error("could not assign a referral code");
}

/** Links a brand-new walker to whoever invited them. Self-referrals and unknown codes are ignored. */
export async function linkReferral(newUserId: string, code: string | undefined) {
  const clean = code?.trim().toUpperCase();
  if (!clean || !REFERRAL_CODE_RE.test(clean)) return;
  await query(
    `update users set referred_by = r.id
       from users r
      where users.id = $1 and users.referred_by is null and r.referral_code = $2 and r.id <> users.id and r.status = 'active'`,
    [newUserId, clean],
  );
}

/**
 * Called inside the review transaction when a walker's upload is verified. On
 * their first verified upload, both they and their referrer get the bonus.
 */
export async function creditReferralBonus(q: Queryable, userId: string, day: string, bonus: number, token: string, actor: string) {
  if (!(bonus > 0)) return null;
  const [u] = await q.query<{ referred_by: string | null; referral_rewarded_at: string | null; referrer_status: string | null }>(
    `select u.referred_by, u.referral_rewarded_at, r.status as referrer_status
       from users u left join users r on r.id = u.referred_by
      where u.id = $1 for update of u`,
    [userId],
  );
  if (!u?.referred_by || u.referral_rewarded_at || u.referrer_status !== "active") return null;
  for (const who of [userId, u.referred_by]) {
    await q.query(
      `insert into rewards (user_id, kind, period_start, period_end, valid_steps, eligible_days, weight, amount,
                            token_symbol, status, reviewed_by, reviewed_at)
       values ($1, 'referral', $2::date, $2::date, 0, 0, 0, $3::numeric, $4, 'approved', $5, now())`,
      [who, day, bonus, token, actor],
    );
  }
  await q.query("update users set referral_rewarded_at = now() where id = $1", [userId]);
  return { referrerId: u.referred_by, bonus };
}

/** What the dashboard's invite card shows. */
export async function referralInfo(userId: string) {
  const code = await ensureReferralCode(userId);
  const stats = await one<{ invited: number; rewarded: number; earned: number }>(
    `select (select count(*)::int from users where referred_by = $1) as invited,
            (select count(*)::int from users where referred_by = $1 and referral_rewarded_at is not null) as rewarded,
            (select coalesce(sum(amount), 0)::float8 from rewards where user_id = $1 and kind = 'referral') as earned`,
    [userId],
  );
  const base = env.appUrl || "https://strydo.xyz";
  return { code, link: `${base}/?ref=${code}`, ...(stats ?? { invited: 0, rewarded: 0, earned: 0 }) };
}
