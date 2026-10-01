import "server-only";
import { tierReward } from "@/lib/rewards/engine";
import { daysBetween, utcToday } from "@/lib/steps/validation";
import { getSettings, toTiers } from "./settings";
import { listUserSteps, type StepEntry } from "./steps";

export interface StepWithEstimate extends StepEntry {
  /** What the day is estimated to earn. Amount only: the rates behind it stay private. */
  estimate: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A walker's uploaded days with the estimated amount each one earns, and the
 * averages shown on the upload page. Estimates, never guarantees: the paid
 * amount is set when the day is reviewed and distributed.
 */
export async function stepEarnings(userId: string) {
  const settings = await getSettings();
  const tiers = toTiers(settings);
  const today = utcToday();
  const entries = await listUserSteps(userId, 30);

  const steps: StepWithEstimate[] = entries.map((e) => ({
    ...e,
    estimate: e.verification === "rejected" ? 0 : tierReward(e.steps, tiers),
  }));

  // One figure per day: the best non-rejected entry.
  const byDay = new Map<string, StepWithEstimate>();
  for (const e of steps) {
    if (e.verification === "rejected") continue;
    const prev = byDay.get(e.day);
    if (!prev || e.steps > prev.steps) byDay.set(e.day, e);
  }
  const days = [...byDay.values()];
  const week = days.filter((d) => daysBetween(d.day, today) < 7);
  const sum = (list: StepWithEstimate[], pick: (d: StepWithEstimate) => number) => list.reduce((a, d) => a + pick(d), 0);

  return {
    steps,
    summary: {
      daysLogged7: week.length,
      avgSteps7: week.length ? Math.round(sum(week, (d) => d.steps) / week.length) : 0,
      avgDaily7: week.length ? round2(sum(week, (d) => d.estimate) / week.length) : 0,
      week7: round2(sum(week, (d) => d.estimate)),
      inReview: round2(sum(days.filter((d) => d.verification !== "verified"), (d) => d.estimate)),
      verified: round2(sum(days.filter((d) => d.verification === "verified"), (d) => d.estimate)),
      goal: settings.dailyStepGoal,
      today,
      tokenSymbol: settings.payoutTokenSymbol,
    },
  };
}
