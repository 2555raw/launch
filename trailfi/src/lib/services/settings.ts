import "server-only";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { one, tx } from "@/lib/db";
import type { RewardConfig } from "@/lib/rewards/engine";

export interface PlatformSettings {
  rewardPercent: number;
  dailyStepGoal: number;
  maxRewardPerUser: number;
  stepCapMultiplier: number;
  distributionFrequency: "daily" | "weekly";
  payoutTokenSymbol: string;
  payoutTokenAddress: `0x${string}`;
  payoutTokenDecimals: number;
  estimatedDailyFees: number;
  redistributeExcess: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

const SELECT = `select reward_percent::float8 as "rewardPercent", daily_step_goal as "dailyStepGoal",
  max_reward_per_user::float8 as "maxRewardPerUser", step_cap_multiplier::float8 as "stepCapMultiplier",
  distribution_frequency as "distributionFrequency", payout_token_symbol as "payoutTokenSymbol",
  payout_token_address as "payoutTokenAddress", payout_token_decimals as "payoutTokenDecimals",
  estimated_daily_fees::float8 as "estimatedDailyFees", redistribute_excess as "redistributeExcess",
  updated_by as "updatedBy", updated_at as "updatedAt" from platform_settings where id = 1`;

export async function getSettings(): Promise<PlatformSettings> {
  const row = await one<PlatformSettings>(SELECT);
  if (!row) throw new Error("platform_settings row missing — run the migrations");
  return row;
}

export function toRewardConfig(s: PlatformSettings): RewardConfig {
  return {
    rewardPercent: s.rewardPercent,
    dailyStepGoal: s.dailyStepGoal,
    maxRewardPerUser: s.maxRewardPerUser,
    stepCapMultiplier: s.stepCapMultiplier,
    redistributeExcess: s.redistributeExcess,
  };
}

export const settingsSchema = z.object({
  rewardPercent: z.number().min(0).max(100),
  dailyStepGoal: z.number().int().min(1000).max(100000),
  maxRewardPerUser: z.number().min(0).max(1_000_000),
  stepCapMultiplier: z.number().min(1).max(10),
  distributionFrequency: z.enum(["daily", "weekly"]),
  payoutTokenSymbol: z.string().trim().min(1).max(12),
  payoutTokenAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a token contract address"),
  payoutTokenDecimals: z.number().int().min(0).max(36),
  estimatedDailyFees: z.number().min(0).max(1_000_000_000),
  redistributeExcess: z.boolean(),
});

export async function updateSettings(input: unknown, actor: string): Promise<PlatformSettings> {
  const s = settingsSchema.parse(input);
  const pending = await one<{ n: number }>("select count(*)::int as n from payouts where status in ('prepared','submitted')");
  const current = await getSettings();
  const tokenChanged =
    current.payoutTokenAddress.toLowerCase() !== s.payoutTokenAddress.toLowerCase() ||
    current.payoutTokenDecimals !== s.payoutTokenDecimals;
  if (tokenChanged && pending && pending.n > 0) {
    throw new HttpError(409, "Finish or cancel the payouts in progress before changing the payout token.", "payouts_in_flight");
  }
  await tx(async (q) => {
    await q.query("insert into settings_history (snapshot, changed_by) values ($1, $2)", [JSON.stringify(current), actor]);
    await q.query(
      `update platform_settings set reward_percent = $1, daily_step_goal = $2, max_reward_per_user = $3,
        step_cap_multiplier = $4, distribution_frequency = $5, payout_token_symbol = $6, payout_token_address = $7,
        payout_token_decimals = $8, estimated_daily_fees = $9, redistribute_excess = $10, updated_by = $11, updated_at = now()
       where id = 1`,
      [
        s.rewardPercent,
        s.dailyStepGoal,
        s.maxRewardPerUser,
        s.stepCapMultiplier,
        s.distributionFrequency,
        s.payoutTokenSymbol.toUpperCase(),
        s.payoutTokenAddress.toLowerCase(),
        s.payoutTokenDecimals,
        s.estimatedDailyFees,
        s.redistributeExcess,
        actor,
      ],
    );
    await audit(actor, "settings.update", "platform_settings", "1", { before: current, after: s }, q);
  });
  return getSettings();
}
