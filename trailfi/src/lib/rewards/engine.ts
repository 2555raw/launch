/**
 * Stepit reward engine — pure functions, no I/O.
 *
 * How a distribution works:
 *   1. pool = eligibleFees × rewardPercent / 100
 *   2. Only verified step entries count. A day counts when steps ≥ dailyStepGoal.
 *   3. A counted day contributes min(steps, dailyStepGoal × stepCapMultiplier)
 *      to the user's weight, so extreme step counts cannot swallow the pool.
 *   4. Each user receives pool × weight / totalWeight, capped at
 *      maxRewardPerUser. When redistributeExcess is on, whatever the cap cuts
 *      off is shared again among users still under the cap ("water-filling");
 *      otherwise it stays in the treasury as `unallocated`.
 *
 * All money is handled as integer micro-units (6 decimals) in bigint to avoid
 * floating-point drift; rounding always goes down, so the sum of allocations
 * can never exceed the pool.
 */

export const MICRO = 1_000_000n;

export interface RewardConfig {
  rewardPercent: number;
  dailyStepGoal: number;
  maxRewardPerUser: number;
  stepCapMultiplier: number;
  redistributeExcess: boolean;
}

export interface ParticipantDay {
  day: string;
  steps: number;
}

export interface Participant {
  userId: string;
  days: ParticipantDay[];
}

export interface Allocation {
  userId: string;
  eligibleDays: number;
  validSteps: number;
  weight: number;
  amountMicro: bigint;
  amount: string;
  capped: boolean;
}

export interface DistributionResult {
  poolMicro: bigint;
  pool: string;
  totalAllocatedMicro: bigint;
  totalAllocated: string;
  unallocated: string;
  totalWeight: number;
  allocations: Allocation[];
}

/** "12.5" → 12500000n. Accepts numbers or decimal strings; extra decimals are truncated. */
export function toMicro(value: number | string | bigint): bigint {
  if (typeof value === "bigint") return value * MICRO;
  const str = typeof value === "number" ? value.toFixed(6) : value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(str)) throw new Error(`Invalid amount: ${value}`);
  const negative = str.startsWith("-");
  const [int, frac = ""] = str.replace("-", "").split(".");
  const micro = BigInt(int) * MICRO + BigInt((frac + "000000").slice(0, 6));
  return negative ? -micro : micro;
}

/** 12500000n → "12.500000" */
export function fromMicro(micro: bigint): string {
  const negative = micro < 0n;
  const abs = negative ? -micro : micro;
  const int = abs / MICRO;
  const frac = (abs % MICRO).toString().padStart(6, "0");
  return `${negative ? "-" : ""}${int}.${frac}`;
}

export function userWeight(days: ParticipantDay[], config: Pick<RewardConfig, "dailyStepGoal" | "stepCapMultiplier">) {
  const cap = Math.floor(config.dailyStepGoal * config.stepCapMultiplier);
  let weight = 0;
  let eligibleDays = 0;
  let validSteps = 0;
  for (const d of days) {
    if (!Number.isFinite(d.steps) || d.steps < config.dailyStepGoal) continue;
    const counted = Math.min(Math.floor(d.steps), cap);
    weight += counted;
    validSteps += counted;
    eligibleDays += 1;
  }
  return { weight, eligibleDays, validSteps };
}

export function validateConfig(config: RewardConfig): string[] {
  const errors: string[] = [];
  if (!(config.rewardPercent >= 0 && config.rewardPercent <= 100)) errors.push("rewardPercent must be between 0 and 100");
  if (!(config.dailyStepGoal >= 1000 && config.dailyStepGoal <= 100000)) errors.push("dailyStepGoal must be between 1,000 and 100,000");
  if (!(config.maxRewardPerUser >= 0)) errors.push("maxRewardPerUser must be ≥ 0");
  if (!(config.stepCapMultiplier >= 1 && config.stepCapMultiplier <= 10)) errors.push("stepCapMultiplier must be between 1 and 10");
  return errors;
}

export function computeDistribution(input: {
  eligibleFees: number | string;
  config: RewardConfig;
  participants: Participant[];
}): DistributionResult {
  const { config } = input;
  const errors = validateConfig(config);
  if (errors.length) throw new Error(errors.join("; "));

  const feesMicro = toMicro(input.eligibleFees);
  if (feesMicro < 0n) throw new Error("eligibleFees must be ≥ 0");

  // Percent with 2 decimals of precision: 30.25% → 3025 / 10000.
  const percentBp = BigInt(Math.round(config.rewardPercent * 100));
  const poolMicro = (feesMicro * percentBp) / 10_000n;
  const capMicro = toMicro(config.maxRewardPerUser);

  const rows = input.participants
    .map((p) => ({ userId: p.userId, ...userWeight(p.days, config) }))
    .filter((r) => r.weight > 0);
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);

  const amounts = new Map<string, bigint>(rows.map((r) => [r.userId, 0n]));
  const capped = new Set<string>();

  let remaining = poolMicro;
  // Water-filling: at most one round per user, since every extra round caps at least one more.
  for (let round = 0; round <= rows.length && remaining > 0n; round++) {
    const open = rows.filter((r) => !capped.has(r.userId));
    const openWeight = BigInt(open.reduce((s, r) => s + r.weight, 0));
    if (openWeight === 0n) break;

    let distributed = 0n;
    let newlyCapped = false;
    for (const r of open) {
      const current = amounts.get(r.userId)!;
      const share = (remaining * BigInt(r.weight)) / openWeight;
      let next = current + share;
      if (next >= capMicro) {
        next = capMicro;
        capped.add(r.userId);
        newlyCapped = true;
      }
      distributed += next - current;
      amounts.set(r.userId, next);
    }
    remaining -= distributed;
    if (!newlyCapped || !config.redistributeExcess) break;
  }

  const allocations: Allocation[] = rows
    .map((r) => {
      const amountMicro = amounts.get(r.userId) ?? 0n;
      return {
        userId: r.userId,
        eligibleDays: r.eligibleDays,
        validSteps: r.validSteps,
        weight: r.weight,
        amountMicro,
        amount: fromMicro(amountMicro),
        capped: capped.has(r.userId),
      };
    })
    .sort((a, b) => (b.amountMicro > a.amountMicro ? 1 : b.amountMicro < a.amountMicro ? -1 : 0));

  const totalAllocatedMicro = allocations.reduce((s, a) => s + a.amountMicro, 0n);
  return {
    poolMicro,
    pool: fromMicro(poolMicro),
    totalAllocatedMicro,
    totalAllocated: fromMicro(totalAllocatedMicro),
    unallocated: fromMicro(poolMicro - totalAllocatedMicro),
    totalWeight,
    allocations,
  };
}

/**
 * Projection for one user for a single day, used by the dashboard and the
 * landing page. It is an estimate only — never a promise of payment.
 */
export function estimateDailyReward(input: {
  steps: number;
  estimatedDailyFees: number;
  config: RewardConfig;
  /** Sum of other users' weights for the day (0 when unknown). */
  otherWeight: number;
}): { amount: string; eligible: boolean; weight: number } {
  const { weight } = userWeight([{ day: "today", steps: input.steps }], input.config);
  if (weight === 0) return { amount: fromMicro(0n), eligible: false, weight };
  const poolMicro = (toMicro(input.estimatedDailyFees) * BigInt(Math.round(input.config.rewardPercent * 100))) / 10_000n;
  const total = BigInt(weight + Math.max(0, Math.floor(input.otherWeight)));
  let share = (poolMicro * BigInt(weight)) / total;
  const capMicro = toMicro(input.config.maxRewardPerUser);
  if (share > capMicro) share = capMicro;
  return { amount: fromMicro(share), eligible: true, weight };
}

/**
 * Tiered daily reward — the rates Stepit actually pays. Private: only the
 * admin API returns the tier settings; walkers only see amounts.
 *   steps < min                 → 0
 *   min ≤ steps < threshold     → avg × 0.85 … avg × 1.15, rising with steps
 *   steps ≥ threshold           → avg × 1.15 … max, reached 8,000 steps above the threshold
 */
export interface RewardTiers {
  tierMin: number;
  tierAvg: number;
  tierThreshold: number;
  tierMax: number;
}

export const BONUS_RAMP_STEPS = 8_000;

export function tierReward(steps: number, t: RewardTiers): number {
  if (!Number.isFinite(steps) || steps < t.tierMin) return 0;
  let amount: number;
  if (steps < t.tierThreshold) {
    const span = Math.max(1, t.tierThreshold - t.tierMin);
    amount = t.tierAvg * (0.85 + (0.3 * (steps - t.tierMin)) / span);
  } else {
    const start = t.tierAvg * 1.15;
    amount = start + (Math.max(start, t.tierMax) - start) * Math.min(1, (steps - t.tierThreshold) / BONUS_RAMP_STEPS);
  }
  return Math.round(amount * 100) / 100;
}

export function validateTiers(t: RewardTiers): string[] {
  const errors: string[] = [];
  if (!(t.tierMin >= 0)) errors.push("tierMin must be ≥ 0");
  if (!(t.tierThreshold > t.tierMin)) errors.push("tierThreshold must be above tierMin");
  if (!(t.tierAvg >= 0)) errors.push("tierAvg must be ≥ 0");
  if (!(t.tierMax >= t.tierAvg)) errors.push("tierMax must be at least tierAvg");
  return errors;
}

/** A distribution under the tiered rates: each eligible day pays tierReward(steps). */
export function computeTierDistribution(input: { tiers: RewardTiers; participants: Participant[] }): DistributionResult {
  const allocations: Allocation[] = input.participants
    .map((p) => {
      let micro = 0n;
      let validSteps = 0;
      let eligibleDays = 0;
      for (const d of p.days) {
        const amount = tierReward(d.steps, input.tiers);
        if (amount <= 0) continue;
        micro += toMicro(amount);
        validSteps += Math.floor(d.steps);
        eligibleDays += 1;
      }
      return { userId: p.userId, eligibleDays, validSteps, weight: validSteps, amountMicro: micro, amount: fromMicro(micro), capped: false };
    })
    .filter((a) => a.amountMicro > 0n)
    .sort((a, b) => (b.amountMicro > a.amountMicro ? 1 : b.amountMicro < a.amountMicro ? -1 : 0));
  const total = allocations.reduce((s, a) => s + a.amountMicro, 0n);
  return {
    poolMicro: total,
    pool: fromMicro(total),
    totalAllocatedMicro: total,
    totalAllocated: fromMicro(total),
    unallocated: fromMicro(0n),
    totalWeight: allocations.reduce((s, a) => s + a.weight, 0),
    allocations,
  };
}
