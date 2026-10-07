import "server-only";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { one, tx } from "@/lib/db";
import { validateTiers, type RatePoint, type RewardConfig, type RewardTiers } from "@/lib/rewards/engine";
import { NATIVE_DECIMALS, isNativeToken } from "@/lib/web3/tokens";

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
  tierMin: number;
  tierAvg: number;
  tierThreshold: number;
  tierMax: number;
  tierCap: number;
  ratePoints: RatePoint[];
  referralBonus: number;
  /** Most dollars creditable per UTC day by verifying uploads; 0 means no limit. */
  dailyBudget: number;
  /** New wallets can't join while true. */
  signupsPaused: boolean;
  /** Dollars for the walker with the most verified steps each week; 0 turns the prize off. */
  weeklyPrize: number;
  /** The Stepit token contract address shown on the home page; empty hides it. */
  projectCa: string;
  updatedBy: string | null;
  updatedAt: string;
}

const SELECT = `select reward_percent::float8 as "rewardPercent", daily_step_goal as "dailyStepGoal",
  max_reward_per_user::float8 as "maxRewardPerUser", step_cap_multiplier::float8 as "stepCapMultiplier",
  distribution_frequency as "distributionFrequency", payout_token_symbol as "payoutTokenSymbol",
  payout_token_address as "payoutTokenAddress", payout_token_decimals as "payoutTokenDecimals",
  estimated_daily_fees::float8 as "estimatedDailyFees", redistribute_excess as "redistributeExcess",
  tier_min as "tierMin", tier_avg::float8 as "tierAvg", tier_threshold as "tierThreshold", tier_max::float8 as "tierMax", tier_cap as "tierCap", rate_points as "ratePoints", referral_bonus::float8 as "referralBonus",
  daily_budget::float8 as "dailyBudget", signups_paused as "signupsPaused", weekly_prize::float8 as "weeklyPrize", project_ca as "projectCa",
  updated_by as "updatedBy", updated_at as "updatedAt" from platform_settings where id = 1`;

export async function getSettings(): Promise<PlatformSettings> {
  const row = await one<PlatformSettings>(SELECT);
  if (!row) throw new Error("platform_settings row missing: run the migrations");
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

export function toTiers(s: PlatformSettings): RewardTiers {
  return { tierMin: s.tierMin, tierAvg: s.tierAvg, tierThreshold: s.tierThreshold, tierMax: s.tierMax, tierCap: s.tierCap, points: s.ratePoints };
}

export const settingsSchema = z.object({
  rewardPercent: z.number().min(0).max(100),
  dailyStepGoal: z.number().int().min(1000).max(100000),
  maxRewardPerUser: z.number().min(0).max(1_000_000),
  stepCapMultiplier: z.number().min(1).max(10),
  distributionFrequency: z.enum(["daily", "weekly"]),
  payoutTokenSymbol: z.string().trim().min(1).max(12),
  // A token contract, or the 0xEeee…EEeE stand in for native ETH.
  payoutTokenAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a token contract address"),
  payoutTokenDecimals: z.number().int().min(0).max(36),
  estimatedDailyFees: z.number().min(0).max(1_000_000_000),
  redistributeExcess: z.boolean(),
  tierMin: z.number().int().min(0).max(100000),
  tierAvg: z.number().min(0).max(1_000_000),
  tierThreshold: z.number().int().min(1).max(200000),
  tierMax: z.number().min(0).max(1_000_000),
  tierCap: z.number().int().min(1).max(500000),
  referralBonus: z.number().min(0).max(1000),
  dailyBudget: z.number().min(0).max(10_000_000).default(0),
  signupsPaused: z.boolean().default(false),
  weeklyPrize: z.number().min(0).max(100_000).default(50),
  projectCa: z
    .string()
    .trim()
    .max(100)
    .regex(/^[A-Za-z0-9]*$/, "the contract address can only have letters and numbers")
    .default(""),
  ratePoints: z.array(z.tuple([z.number().int().min(0).max(500000), z.number().min(0).max(1_000_000)])).min(2).max(12),
});

export async function updateSettings(input: unknown, actor: string): Promise<PlatformSettings> {
  const s = settingsSchema.parse(input);
  const tierErrors = validateTiers({ ...s, points: s.ratePoints });
  if (tierErrors.length) throw new HttpError(422, tierErrors.join("; "), "invalid_tiers");
  // Native ETH amounts are wei: any other scale would send the wrong amount.
  if (isNativeToken(s.payoutTokenAddress) && s.payoutTokenDecimals !== NATIVE_DECIMALS) {
    throw new HttpError(422, `Native ETH uses ${NATIVE_DECIMALS} decimals.`, "invalid_decimals");
  }
  const pending = await one<{ n: number }>("select count(*)::int as n from payouts where status in ('requested','prepared','submitted')");
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
        payout_token_decimals = $8, estimated_daily_fees = $9, redistribute_excess = $10, updated_by = $11, updated_at = now(),
        tier_min = $12, tier_avg = $13, tier_threshold = $14, tier_max = $15, tier_cap = $16, rate_points = $17::jsonb, referral_bonus = $18,
        daily_budget = $19, signups_paused = $20, weekly_prize = $21, project_ca = $22
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
        s.tierMin,
        s.tierAvg,
        s.tierThreshold,
        s.tierMax,
        s.tierCap,
        JSON.stringify(s.ratePoints),
        s.referralBonus,
        s.dailyBudget,
        s.signupsPaused,
        s.weeklyPrize,
        s.projectCa,
      ],
    );
    await audit(actor, "settings.update", "platform_settings", "1", { before: current, after: s }, q);
  });
  return getSettings();
}
