import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDistribution, estimateDailyReward, fromMicro, toMicro, type RewardConfig } from "../src/lib/rewards/engine.ts";

const config: RewardConfig = {
  rewardPercent: 30,
  dailyStepGoal: 10_000,
  maxRewardPerUser: 25,
  stepCapMultiplier: 2,
  redistributeExcess: true,
};

test("micro-unit conversions round-trip", () => {
  assert.equal(toMicro("12.5"), 12_500_000n);
  assert.equal(toMicro(0.1), 100_000n);
  assert.equal(toMicro("1.1234569"), 1_123_456n);
  assert.equal(fromMicro(12_500_000n), "12.500000");
  assert.throws(() => toMicro("abc"));
});

test("100 USDC fees at 30% make a 30 USDC pool split by valid steps", () => {
  const r = computeDistribution({
    eligibleFees: 100,
    config,
    participants: [
      { userId: "a", days: [{ day: "d", steps: 10_000 }] },
      { userId: "b", days: [{ day: "d", steps: 20_000 }] },
      { userId: "c", days: [{ day: "d", steps: 9_999 }] }, // below goal → excluded
    ],
  });
  assert.equal(r.pool, "30.000000");
  assert.equal(r.allocations.length, 2);
  assert.equal(r.allocations.find((a) => a.userId === "a")!.amount, "10.000000");
  assert.equal(r.allocations.find((a) => a.userId === "b")!.amount, "20.000000");
  assert.equal(r.unallocated, "0.000000");
});

test("steps above goal × multiplier are capped", () => {
  const r = computeDistribution({
    eligibleFees: 100,
    config,
    participants: [
      { userId: "a", days: [{ day: "d", steps: 20_000 }] },
      { userId: "b", days: [{ day: "d", steps: 90_000 }] },
    ],
  });
  assert.equal(r.allocations[0].amount, "15.000000");
  assert.equal(r.allocations[1].amount, "15.000000");
});

test("per-user cap redistributes the excess when enabled", () => {
  const r = computeDistribution({
    eligibleFees: 100,
    config: { ...config, maxRewardPerUser: 12 },
    participants: [
      { userId: "big", days: [{ day: "d", steps: 20_000 }] },
      { userId: "s1", days: [{ day: "d", steps: 10_000 }] },
      { userId: "s2", days: [{ day: "d", steps: 10_000 }] },
    ],
  });
  // big would get 15, capped at 12; the 3 excess goes to s1/s2 (7.5 → 9 each).
  const get = (id: string) => r.allocations.find((a) => a.userId === id)!;
  assert.equal(get("big").amount, "12.000000");
  assert.equal(get("big").capped, true);
  assert.equal(get("s1").amount, "9.000000");
  assert.equal(get("s2").amount, "9.000000");
  assert.equal(r.totalAllocated, "30.000000");
});

test("per-user cap keeps the excess in the treasury when redistribution is off", () => {
  const r = computeDistribution({
    eligibleFees: 100,
    config: { ...config, maxRewardPerUser: 12, redistributeExcess: false },
    participants: [
      { userId: "big", days: [{ day: "d", steps: 20_000 }] },
      { userId: "s1", days: [{ day: "d", steps: 10_000 }] },
      { userId: "s2", days: [{ day: "d", steps: 10_000 }] },
    ],
  });
  assert.equal(r.totalAllocated, "27.000000");
  assert.equal(r.unallocated, "3.000000");
});

test("allocations never exceed the pool (rounding goes down)", () => {
  const participants = Array.from({ length: 7 }, (_, i) => ({
    userId: `u${i}`,
    days: [{ day: "d", steps: 10_000 + i * 1_337 }],
  }));
  const r = computeDistribution({ eligibleFees: "33.333333", config: { ...config, maxRewardPerUser: 1000 }, participants });
  assert.ok(r.totalAllocatedMicro <= r.poolMicro);
  assert.ok(r.poolMicro - r.totalAllocatedMicro < 10n);
});

test("weekly periods sum every day that meets the goal", () => {
  const r = computeDistribution({
    eligibleFees: 700,
    config: { ...config, maxRewardPerUser: 1000 },
    participants: [
      { userId: "a", days: [{ day: "1", steps: 12_000 }, { day: "2", steps: 3_000 }, { day: "3", steps: 10_000 }] },
    ],
  });
  assert.equal(r.allocations[0].eligibleDays, 2);
  assert.equal(r.allocations[0].validSteps, 22_000);
  assert.equal(r.allocations[0].amount, "210.000000");
});

test("no eligible users leaves the whole pool unallocated", () => {
  const r = computeDistribution({ eligibleFees: 100, config, participants: [] });
  assert.equal(r.allocations.length, 0);
  assert.equal(r.unallocated, "30.000000");
});

test("invalid configuration is rejected", () => {
  assert.throws(() => computeDistribution({ eligibleFees: 1, config: { ...config, rewardPercent: 120 }, participants: [] }));
});

test("daily estimate is proportional, capped, and zero below the goal", () => {
  assert.equal(estimateDailyReward({ steps: 5_000, estimatedDailyFees: 100, config, otherWeight: 0 }).eligible, false);
  const alone = estimateDailyReward({ steps: 10_000, estimatedDailyFees: 100, config, otherWeight: 0 });
  assert.equal(alone.amount, "25.000000"); // 30 pool capped at 25
  const shared = estimateDailyReward({ steps: 10_000, estimatedDailyFees: 100, config, otherWeight: 50_000 });
  assert.equal(shared.amount, "5.000000");
});

import { tierReward, validateTiers, type RewardTiers } from "../src/lib/rewards/engine.ts";

const tiers: RewardTiers = { tierMin: 0, tierAvg: 3.7, tierThreshold: 7000, tierMax: 5, tierCap: 10000 };

test("rates: grow in a straight line up to $3.70 at 7,000 steps", () => {
  assert.equal(tierReward(0, tiers), 0);
  assert.equal(tierReward(3500, tiers), 1.85);
  assert.equal(tierReward(7000, tiers), 3.7);
  for (let s = 0; s < 7000; s += 250) assert.ok(tierReward(s + 250, tiers) >= tierReward(s, tiers));
});

test("rates: $3.70 to $5 between 7,000 and 10,000 steps, then $5", () => {
  assert.equal(tierReward(8500, tiers), 4.35);
  assert.equal(tierReward(10000, tiers), 5);
  assert.equal(tierReward(25000, tiers), 5);
  assert.equal(tierReward(Number.NaN, tiers), 0);
});

test("rates: a minimum step count can be set", () => {
  const t = { ...tiers, tierMin: 1000 };
  assert.equal(tierReward(1000, t), 0);
  assert.equal(tierReward(4000, t), 1.85);
  assert.equal(tierReward(7000, t), 3.7);
});

test("rates: invalid configurations are rejected", () => {
  assert.equal(validateTiers(tiers).length, 0);
  assert.ok(validateTiers({ ...tiers, tierCap: 6000 }).length > 0);
  assert.ok(validateTiers({ ...tiers, tierMax: 2 }).length > 0);
});
