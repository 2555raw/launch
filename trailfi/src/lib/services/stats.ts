import "server-only";
import { one, query } from "@/lib/db";
import { env } from "@/lib/env";
import { publicClient } from "@/lib/web3/server";
import { getSettings } from "./settings";

const tokenCheckCache = new Map<string, { ok: boolean; at: number }>();

/**
 * Whether the configured payout token is a contract on the payout network.
 * Catches a token address left over from another chain before anyone tries to pay with it.
 */
export async function payoutTokenReady(address: `0x${string}`): Promise<boolean> {
  const key = address.toLowerCase();
  const hit = tokenCheckCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.ok;
  let ok = false;
  try {
    const code = await publicClient().getCode({ address });
    ok = Boolean(code && code !== "0x");
  } catch {
    ok = false;
  }
  tokenCheckCache.set(key, { ok, at: Date.now() });
  return ok;
}

/** Live numbers for the public landing page. Totals only: no wallets, no rates. */
export async function publicStats() {
  const [walkers, today, series, paid, settings] = await Promise.all([
    one<{ n: number }>("select count(*)::int as n from users where status = 'active'"),
    one<{ walkers: number; steps: number; goalMet: number }>(
      `with d as (select user_id, max(steps) as steps from step_entries
                   where day = current_date and verification <> 'rejected' group by user_id)
       select count(*)::int as walkers, coalesce(sum(steps), 0)::int as steps,
              count(*) filter (where steps >= (select daily_step_goal from platform_settings where id = 1))::int as "goalMet" from d`,
    ),
    query<{ day: string; steps: number }>(
      `with days as (select generate_series(current_date - 13, current_date, interval '1 day')::date as day),
            per as (select user_id, day, max(steps) as steps from step_entries
                     where day >= current_date - 13 and verification <> 'rejected' group by user_id, day)
       select d.day::text as day, coalesce(sum(p.steps), 0)::int as steps
         from days d left join per p on p.day = d.day group by d.day order by d.day`,
    ),
    one<{ total: number; count: number }>(
      `select coalesce(sum(amount), 0)::float8 as total, count(*)::int as count
         from payouts where status = 'confirmed' and not simulated`,
    ),
    getSettings(),
  ]);
  return {
    walkers: walkers?.n ?? 0,
    today: today ?? { walkers: 0, steps: 0, goalMet: 0 },
    series,
    paid: paid ?? { total: 0, count: 0 },
    dailyGoal: settings.dailyStepGoal,
    tokenSymbol: settings.payoutTokenSymbol,
  };
}

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
    one<{ confirmed: number; inFlight: number; failed: number; requested: number }>(
      `select count(*) filter (where status = 'confirmed')::int as confirmed,
              count(*) filter (where status in ('prepared', 'submitted'))::int as "inFlight",
              count(*) filter (where status = 'requested')::int as requested,
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
  const subscribers = await one<{ n: number }>("select count(*)::int as n from newsletter_subscribers");
  return {
    tokenReady: await payoutTokenReady(settings.payoutTokenAddress),
    users: totals,
    today,
    rewards,
    payouts,
    series,
    stepsAwaitingReview: flagged?.n ?? 0,
    newsletterSubscribers: subscribers?.n ?? 0,
    settings,
    payoutWallets: env.payoutWallets,
    demoMode: env.demoMode,
  };
}
