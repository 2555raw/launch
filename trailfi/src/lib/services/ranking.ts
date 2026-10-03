import "server-only";
import { query } from "@/lib/db";

export interface RankingRow {
  rank: number;
  /** Shortened wallet, never the full address. */
  wallet: string;
  steps: number;
  days: number;
  you: boolean;
}

export interface WeeklyRanking {
  weekStart: string;
  weekEnd: string;
  walkers: number;
  rows: RankingRow[];
  /** The signed-in walker's place, when they have verified steps that week. */
  me: RankingRow | null;
}

const short = (w: string) => `${w.slice(0, 6)}…${w.slice(-4)}`;

/**
 * Walkers ranked by verified steps in one UTC week (Monday to Sunday).
 * Only verified uploads count, and admin or suspended wallets are left out.
 */
export async function weeklyRanking(which: "this" | "last", userId: string | null, limit = 10): Promise<WeeklyRanking> {
  const offset = which === "last" ? 7 : 0;
  const [{ start, end }] = await query<{ start: string; end: string }>(
    `select (date_trunc('week', (now() at time zone 'utc'))::date - $1::int)::text as "start",
            (date_trunc('week', (now() at time zone 'utc'))::date - $1::int + 6)::text as "end"`,
    [offset],
  );
  const rows = await query<{ userId: string; wallet: string; steps: number; days: number; rank: number }>(
    `with totals as (
       select s.user_id, sum(s.steps)::int as steps, count(distinct s.day)::int as days
         from step_entries s
         join users u on u.id = s.user_id
        where s.verification = 'verified'
          and s.day >= $1::date and s.day <= $2::date
          and u.status = 'active' and u.role <> 'admin'
        group by s.user_id
     )
     select t.user_id as "userId", u.wallet_address as wallet, t.steps, t.days,
            rank() over (order by t.steps desc)::int as rank
       from totals t join users u on u.id = t.user_id
      order by t.steps desc, u.short_id`,
    [start, end],
  );
  const toRow = (r: (typeof rows)[number]): RankingRow => ({
    rank: r.rank,
    wallet: short(r.wallet),
    steps: Number(r.steps),
    days: Number(r.days),
    you: r.userId === userId,
  });
  const mine = userId ? rows.find((r) => r.userId === userId) : undefined;
  return {
    weekStart: start,
    weekEnd: end,
    walkers: rows.length,
    rows: rows.slice(0, limit).map(toRow),
    me: mine ? toRow(mine) : null,
  };
}
