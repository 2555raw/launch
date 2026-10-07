import "server-only";
import { HttpError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { one, query, tx } from "@/lib/db";
import { getSettings } from "./settings";

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
  /** USDG the week's #1 wins; 0 when the prize is off. */
  prize: number;
  /** For a finished week: whether the prize has been awarded already. */
  prizeAwarded: boolean;
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
  const [settings, awarded] = await Promise.all([
    getSettings(),
    one<{ id: string }>("select id from rewards where kind = 'prize' and period_start = $1::date", [start]),
  ]);
  return {
    weekStart: start,
    weekEnd: end,
    walkers: rows.length,
    rows: rows.slice(0, limit).map(toRow),
    me: mine ? toRow(mine) : null,
    prize: settings.weeklyPrize,
    prizeAwarded: Boolean(awarded),
  };
}

export interface PrizeStatus {
  weekStart: string;
  weekEnd: string;
  prize: number;
  /** Last week's #1, with the full wallet (admins only). Ties go to whoever joined first. */
  winner: { userId: string; userShortId: number; walletAddress: string; steps: number } | null;
  awarded: boolean;
}

/** Last week's winner for the admin, and whether the prize was already credited. */
export async function lastWeekPrize(): Promise<PrizeStatus> {
  const [{ start, end }] = await query<{ start: string; end: string }>(
    `select (date_trunc('week', (now() at time zone 'utc'))::date - 7)::text as "start",
            (date_trunc('week', (now() at time zone 'utc'))::date - 1)::text as "end"`,
  );
  const [settings, winner, awarded] = await Promise.all([
    getSettings(),
    one<{ userId: string; userShortId: number; walletAddress: string; steps: number }>(
      `select s.user_id as "userId", u.short_id as "userShortId", u.wallet_address as "walletAddress", sum(s.steps)::int as steps
         from step_entries s join users u on u.id = s.user_id
        where s.verification = 'verified' and s.day >= $1::date and s.day <= $2::date
          and u.status = 'active' and u.role <> 'admin'
        group by s.user_id, u.short_id, u.wallet_address
        order by sum(s.steps) desc, u.short_id
        limit 1`,
      [start, end],
    ),
    one<{ id: string }>("select id from rewards where kind = 'prize' and period_start = $1::date", [start]),
  ]);
  return { weekStart: start, weekEnd: end, prize: settings.weeklyPrize, winner: winner ? { ...winner, steps: Number(winner.steps) } : null, awarded: Boolean(awarded) };
}

/** Credits last week's prize to the winner as an approved reward, ready to pay. Once per week. */
export async function awardLastWeekPrize(actor: string): Promise<PrizeStatus> {
  const status = await lastWeekPrize();
  if (!status.winner) throw new HttpError(409, "Nobody has verified steps last week.", "no_winner");
  if (status.prize <= 0) throw new HttpError(409, "The weekly prize is set to 0.", "prize_off");
  if (status.awarded) throw new HttpError(409, "Last week's prize was already awarded.", "already_awarded");
  const settings = await getSettings();
  await tx(async (q) => {
    await q.query(
      `insert into rewards (user_id, kind, period_start, period_end, valid_steps, eligible_days, weight, amount,
                            token_symbol, status, reviewed_by, reviewed_at)
       values ($1, 'prize', $2::date, $3::date, 0, 0, 0, $4::numeric, $5, 'approved', $6, now())`,
      [status.winner!.userId, status.weekStart, status.weekEnd, status.prize, settings.payoutTokenSymbol, actor],
    );
    await audit(actor, "prize.award", "user", status.winner!.userId, { week: status.weekStart, amount: status.prize, steps: status.winner!.steps }, q);
  });
  return lastWeekPrize();
}
