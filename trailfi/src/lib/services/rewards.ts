import "server-only";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { one, query, tx } from "@/lib/db";
import { computeTierDistribution, tierReward, type Participant } from "@/lib/rewards/engine";
import { daysBetween, utcToday } from "@/lib/steps/validation";
import { getSettings, toRewardConfig, toTiers } from "./settings";

export const distributionSchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eligibleFees: z.number().min(0).max(1_000_000_000),
});

async function participantsFor(periodStart: string, periodEnd: string): Promise<Participant[]> {
  // Only verified entries from active users count. When a day has several verified
  // sources (e.g. Apple Health and a later connector), the highest single source is used — never the sum.
  const rows = await query<{ user_id: string; day: string; steps: number }>(
    `select s.user_id, s.day::text as day, max(s.steps) as steps
       from step_entries s join users u on u.id = s.user_id
      where s.verification = 'verified' and u.status = 'active' and s.day between $1::date and $2::date
        and not exists (select 1 from rewards r where r.step_entry_id = s.id)
      group by s.user_id, s.day`,
    [periodStart, periodEnd],
  );
  const byUser = new Map<string, Participant>();
  for (const r of rows) {
    const p = byUser.get(r.user_id) ?? { userId: r.user_id, days: [] };
    p.days.push({ day: r.day, steps: Number(r.steps) });
    byUser.set(r.user_id, p);
  }
  return [...byUser.values()];
}

function checkPeriod(periodStart: string, periodEnd: string, frequency: "daily" | "weekly") {
  const len = daysBetween(periodStart, periodEnd) + 1;
  if (len < 1) throw new HttpError(422, "The period end must be on or after its start.", "invalid_period");
  if (len > (frequency === "weekly" ? 7 : 1)) {
    throw new HttpError(422, `With ${frequency} distribution a period can be at most ${frequency === "weekly" ? 7 : 1} day(s).`, "invalid_period");
  }
  if (daysBetween(periodEnd, utcToday()) < 1) {
    throw new HttpError(422, "Only periods that have fully ended (before today, UTC) can be distributed.", "period_open");
  }
}

export async function previewDistribution(input: unknown) {
  const { periodStart, periodEnd, eligibleFees } = distributionSchema.parse(input);
  const settings = await getSettings();
  checkPeriod(periodStart, periodEnd, settings.distributionFrequency);
  const overlap = await one<{ id: string }>(
    "select id from distributions where period_start <= $2::date and period_end >= $1::date limit 1",
    [periodStart, periodEnd],
  );
  const participants = await participantsFor(periodStart, periodEnd);
  const result = computeTierDistribution({ tiers: toTiers(settings), participants });
  const wallets = await query<{ id: string; wallet_address: string }>(
    "select id, wallet_address from users where id = any($1::uuid[])",
    [result.allocations.map((a) => a.userId)],
  );
  const walletOf = new Map(wallets.map((w) => [w.id, w.wallet_address]));
  return {
    periodStart,
    periodEnd,
    eligibleFees,
    settings,
    overlapsExisting: Boolean(overlap),
    ...result,
    allocations: result.allocations.map((a) => ({ ...a, walletAddress: walletOf.get(a.userId) ?? null })),
  };
}

/** Runs the engine and stores every allocation as a pending reward awaiting admin approval. */
export async function createDistribution(input: unknown, actor: string) {
  const preview = await previewDistribution(input);
  if (preview.overlapsExisting) {
    throw new HttpError(409, "A distribution already covers part of this period.", "overlap");
  }
  const { settings } = preview;
  return tx(async (q) => {
    const [dist] = await q.query<{ id: string }>(
      `insert into distributions (period_start, period_end, eligible_fees, reward_percent, pool_amount, total_allocated,
         participants, config, token_symbol, created_by)
       values ($1::date, $2::date, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
      [
        preview.periodStart,
        preview.periodEnd,
        preview.eligibleFees,
        settings.rewardPercent,
        preview.pool,
        preview.totalAllocated,
        preview.allocations.length,
        JSON.stringify(toRewardConfig(settings)),
        settings.payoutTokenSymbol,
        actor,
      ],
    );
    for (const a of preview.allocations) {
      if (a.amountMicro === 0n) continue;
      await q.query(
        `insert into rewards (distribution_id, user_id, period_start, period_end, valid_steps, eligible_days, weight, amount, capped, token_symbol)
         values ($1, $2, $3::date, $4::date, $5, $6, $7, $8, $9, $10)`,
        [dist.id, a.userId, preview.periodStart, preview.periodEnd, a.validSteps, a.eligibleDays, a.weight, a.amount, a.capped, settings.payoutTokenSymbol],
      );
    }
    await audit(actor, "distribution.create", "distribution", dist.id, {
      period: [preview.periodStart, preview.periodEnd],
      eligibleFees: preview.eligibleFees,
      pool: preview.pool,
      allocated: preview.totalAllocated,
      participants: preview.allocations.length,
    }, q);
    return { id: dist.id, ...preview };
  });
}

export async function listDistributions(limit = 30) {
  return query(
    `select id, period_start::text as "periodStart", period_end::text as "periodEnd", eligible_fees::float8 as "eligibleFees",
       reward_percent::float8 as "rewardPercent", pool_amount::float8 as "pool", total_allocated::float8 as "totalAllocated",
       participants, token_symbol as "tokenSymbol", created_by as "createdBy", created_at as "createdAt"
     from distributions order by period_start desc, created_at desc limit $1`,
    [limit],
  );
}

export const rewardStatusFilter = z.enum(["pending", "approved", "rejected", "processing", "paid", "all"]).default("pending");

export async function listRewards(opts: { status?: string; userId?: string; limit?: number }) {
  const status = rewardStatusFilter.parse(opts.status ?? "pending");
  const params: unknown[] = [];
  const where: string[] = [];
  if (status !== "all") where.push(`r.status = $${params.push(status)}`);
  if (opts.userId) where.push(`r.user_id = $${params.push(opts.userId)}`);
  params.push(opts.limit ?? 200);
  return query(
    `select r.id, r.user_id as "userId", u.short_id as "userShortId", u.wallet_address as "walletAddress",
       r.period_start::text as "periodStart", r.period_end::text as "periodEnd", r.valid_steps as "validSteps",
       r.eligible_days as "eligibleDays", r.amount::float8 as amount, r.capped, r.token_symbol as "tokenSymbol",
       r.status, r.reviewed_by as "reviewedBy", r.rejection_reason as "rejectionReason", r.payout_id as "payoutId",
       r.kind, r.created_at as "createdAt"
     from rewards r join users u on u.id = r.user_id
     ${where.length ? "where " + where.join(" and ") : ""}
     order by r.created_at desc limit $${params.length}`,
    params,
  );
}

export const rewardReviewSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(300).optional(),
});

export async function reviewRewards(input: unknown, actor: string) {
  const { ids, decision, reason } = rewardReviewSchema.parse(input);
  if (decision === "rejected" && !reason) throw new HttpError(422, "Give a reason when rejecting a reward.", "reason_required");
  // Only pending rewards move; anything already paid or in a payout is untouched.
  const rows = await query<{ id: string }>(
    `update rewards set status = $2, reviewed_by = $3, reviewed_at = now(), rejection_reason = $4
      where id = any($1::uuid[]) and status = 'pending' returning id`,
    [ids, decision, actor, decision === "rejected" ? reason : null],
  );
  await audit(actor, `rewards.${decision}`, "reward", null, { ids: rows.map((r) => r.id), reason });
  return { updated: rows.length, skipped: ids.length - rows.length };
}

/** Totals for a user's dashboard. */
export async function rewardSummary(userId: string) {
  const row = await one<{ pending: number; approved: number; processing: number; paid: number; total: number }>(
    `select
       coalesce(sum(amount) filter (where status = 'pending'), 0)::float8 as pending,
       coalesce(sum(amount) filter (where status = 'approved'), 0)::float8 as approved,
       coalesce(sum(amount) filter (where status = 'processing'), 0)::float8 as processing,
       coalesce(sum(amount) filter (where status = 'paid'), 0)::float8 as paid,
       coalesce(sum(amount) filter (where status <> 'rejected'), 0)::float8 as total
     from rewards where user_id = $1`,
    [userId],
  );
  return row ?? { pending: 0, approved: 0, processing: 0, paid: 0, total: 0 };
}

/** Today's projection for one user: an estimate from current settings, never a guarantee. */
export async function estimateToday(userId: string) {
  const settings = await getSettings();
  const today = utcToday();
  const row = await one<{ steps: number }>(
    `select max(steps) as steps from step_entries
      where user_id = $1 and day = $2::date and verification in ('verified', 'unverified')`,
    [userId, today],
  );
  const steps = Number(row?.steps ?? 0);
  const amount = tierReward(steps, toTiers(settings));
  return { today, steps, goal: settings.dailyStepGoal, amount: amount.toFixed(6), eligible: amount > 0, tokenSymbol: settings.payoutTokenSymbol };
}
