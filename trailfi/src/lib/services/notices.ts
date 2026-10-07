import "server-only";
import { explorerTxUrl } from "@/lib/web3/chains";
import { query } from "@/lib/db";

export interface Notice {
  kind: "verified" | "rejected" | "paid";
  id: string;
  day?: string;
  steps?: number;
  /** Dollars credited for a verified day; for a paid notice, the amount in the token sent (ETH for native payouts). */
  amount?: string | null;
  /** Paid notices: the dollar value of the payout and the token it was sent in. */
  usdAmount?: string | null;
  token?: string;
  note?: string | null;
  txUrl?: string | null;
}

/** Reviews and payouts the walker has not seen yet, oldest first. */
export async function unseenNotices(userId: string): Promise<Notice[]> {
  const [reviews, paid] = await Promise.all([
    query<{ id: string; day: string; steps: number; verification: string; note: string | null; amount: string | null }>(
      `select s.id, s.day::text as day, s.steps, s.verification, s.review_note as note, r.amount::text as amount
         from step_entries s
         left join rewards r on r.step_entry_id = s.id
        where s.user_id = $1 and s.verification in ('verified', 'rejected') and s.reviewed_at is not null and s.result_seen_at is null
        order by s.reviewed_at
        limit 10`,
      [userId],
    ),
    query<{ id: string; amount: string; usdAmount: string; token: string; chainId: number; txHash: string | null; simulated: boolean }>(
      `select id, round(amount, token_decimals)::text as amount, round(coalesce(usd_amount, amount), 6)::text as "usdAmount",
              token_symbol as token, chain_id as "chainId", tx_hash as "txHash", simulated
         from payouts where user_id = $1 and status = 'confirmed' and seen_at is null
        order by confirmed_at limit 5`,
      [userId],
    ),
  ]);
  return [
    ...reviews.map((r) => ({
      kind: r.verification as "verified" | "rejected",
      id: r.id,
      day: r.day,
      steps: Number(r.steps),
      amount: r.amount,
      note: r.note,
    })),
    ...paid.map((p) => ({
      kind: "paid" as const,
      id: p.id,
      amount: p.amount,
      usdAmount: p.usdAmount,
      token: p.token,
      txUrl: p.txHash && !p.simulated ? explorerTxUrl(p.chainId, p.txHash) : null,
    })),
  ];
}

/** Marks notices as seen so they show only once. Only the walker's own rows are touched. */
export async function markNoticesSeen(userId: string, entryIds: string[], payoutIds: string[]) {
  const ok = (ids: string[]) => ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 50);
  const entries = ok(entryIds), payouts = ok(payoutIds);
  if (entries.length) {
    await query("update step_entries set result_seen_at = now() where user_id = $1 and id = any($2::uuid[]) and result_seen_at is null", [userId, entries]);
  }
  if (payouts.length) {
    await query("update payouts set seen_at = now() where user_id = $1 and id = any($2::uuid[]) and seen_at is null", [userId, payouts]);
  }
}

/** Public facts about a confirmed payout for its share page: no wallet, just the amount and steps. */
export async function getSharePayout(id: string): Promise<{ amount: string; usdAmount: string; steps: number; token: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await query<{ amount: string; usdAmount: string; steps: number; token: string }>(
    `select round(p.amount, p.token_decimals)::text as amount, round(coalesce(p.usd_amount, p.amount), 6)::text as "usdAmount",
            p.token_symbol as token,
            (select coalesce(sum(r.valid_steps), 0)::int from rewards r where r.payout_id = p.id) as steps
       from payouts p where p.id = $1 and p.status = 'confirmed'`,
    [id],
  );
  return row ? { ...row, steps: Number(row.steps) } : null;
}
