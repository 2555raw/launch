import "server-only";
import { one, query } from "@/lib/db";
import { env } from "@/lib/env";
import { shortAddress } from "@/lib/format";
import { DEMO_LEADERBOARD } from "@/lib/demo-data";
import { getSettings } from "./settings";

export async function platformOverview() {
  const [totals, today, rewards, payouts, series, flagged, settings] = await Promise.all([
    one<{ users: number; suspended: number; newWeek: number }>(
      `select count(*)::int as users, count(*) filter (where status = 'suspended')::int as suspended,
         count(*) filter (where created_at > now() - interval '7 days')::int as "newWeek" from users`,
    ),
    one<{ active: number; steps: number; goalMet: number }>(
      `with d as (select user_id, max(steps) as steps from step_entries
                   where day = current_date and verification <> 'rejected' group by user_id)
       select count(*)::int as active, coalesce(sum(steps), 0)::int as steps,
              count(*) filter (where steps >= (select daily_step_goal from platform_settings where id = 1))::int as "goalMet" from d`,
    ),
    one<{ pending: number; approved: number; processing: number; paid: number; distributed: number }>(
      `select coalesce(sum(amount) filter (where status = 'pending'), 0)::float8 as pending,
              coalesce(sum(amount) filter (where status = 'approved'), 0)::float8 as approved,
              coalesce(sum(amount) filter (where status = 'processing'), 0)::float8 as processing,
              coalesce(sum(amount) filter (where status = 'paid'), 0)::float8 as paid,
              coalesce(sum(amount) filter (where status <> 'rejected'), 0)::float8 as distributed
         from rewards`,
    ),
    one<{ confirmed: number; inFlight: number; failed: number }>(
      `select count(*) filter (where status = 'confirmed')::int as confirmed,
              count(*) filter (where status in ('prepared', 'submitted'))::int as "inFlight",
              count(*) filter (where status = 'failed')::int as failed from payouts`,
    ),
    query<{ day: string; steps: number; users: number }>(
      `with days as (select generate_series(current_date - 13, current_date, interval '1 day')::date as day),
            per as (select user_id, day, max(steps) as steps from step_entries
                     where day >= current_date - 13 and verification <> 'rejected' group by user_id, day)
       select d.day::text as day, coalesce(sum(p.steps), 0)::int as steps, count(p.user_id)::int as users
         from days d left join per p on p.day = d.day group by d.day order by d.day`,
    ),
    one<{ n: number }>("select count(*)::int as n from step_entries where verification in ('flagged', 'unverified')"),
    getSettings(),
  ]);
  return {
    users: totals,
    today,
    rewards,
    payouts,
    series,
    stepsAwaitingReview: flagged?.n ?? 0,
    settings,
    payoutWallets: env.payoutWallets,
    demoMode: env.demoMode,
  };
}

export interface LeaderboardRow {
  rank: number;
  wallet: string;
  steps: number;
  rewards: number;
}

/**
 * Public leaderboard: today's steps and lifetime rewards, wallets shortened.
 * Until enough real users exist it returns the demo table, flagged as such.
 */
export async function leaderboard(): Promise<{ demo: boolean; rows: LeaderboardRow[]; tokenSymbol: string }> {
  const settings = await getSettings();
  const rows = await query<{ wallet: string; steps: number; rewards: number }>(
    `select u.wallet_address as wallet, coalesce(t.steps, 0)::int as steps, coalesce(r.total, 0)::float8 as rewards
       from users u
       left join (select user_id, max(steps) as steps from step_entries
                   where day = current_date and verification <> 'rejected' group by user_id) t on t.user_id = u.id
       left join (select user_id, sum(amount) as total from rewards where status <> 'rejected' group by user_id) r on r.user_id = u.id
      where u.status = 'active' and (t.steps > 0 or r.total > 0)
      order by steps desc, rewards desc limit 10`,
  );
  if (rows.length < 5) return { demo: true, rows: DEMO_LEADERBOARD, tokenSymbol: settings.payoutTokenSymbol };
  return {
    demo: false,
    tokenSymbol: settings.payoutTokenSymbol,
    rows: rows.map((r, i) => ({ rank: i + 1, wallet: shortAddress(r.wallet), steps: Number(r.steps), rewards: Number(r.rewards) })),
  };
}
