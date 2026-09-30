/**
 * Step submission rules — pure functions, no I/O.
 *
 * Hard rules reject a submission outright. Soft rules add flags: a flagged
 * entry is stored but can never be paid until an admin reviews it.
 */

export const HARD_MAX_STEPS = 100_000;
export const FLAG_ABOVE_STEPS = 45_000;
export const MANUAL_MAX_AGE_DAYS = 7;
export const PROVIDER_MAX_AGE_DAYS = 30;

export type StepSource = "manual_demo" | "apple_health" | "health_connect" | "fitness_api";

export interface StepCheckInput {
  day: string;
  steps: number;
  source: StepSource;
  /** Today's date (UTC) as YYYY-MM-DD; injected for testability. */
  today: string;
  /** The user's recent daily step counts (other days), newest first. */
  recentSteps: number[];
}

export type StepCheck =
  | { ok: true; flags: string[] }
  | { ok: false; error: string };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function checkStepSubmission(input: StepCheckInput): StepCheck {
  const { day, steps, source, today } = input;

  if (!DAY_RE.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) {
    return { ok: false, error: "Date must be in YYYY-MM-DD format." };
  }
  if (!Number.isInteger(steps) || steps < 0) {
    return { ok: false, error: "Steps must be a whole number of zero or more." };
  }
  if (steps > HARD_MAX_STEPS) {
    return { ok: false, error: `More than ${HARD_MAX_STEPS.toLocaleString("en-US")} steps in a day is not accepted.` };
  }

  const age = daysBetween(day, today);
  // One day of tolerance ahead of UTC for users east of Greenwich.
  if (age < -1) return { ok: false, error: "You cannot log steps for a future date." };
  const maxAge = source === "manual_demo" ? MANUAL_MAX_AGE_DAYS : PROVIDER_MAX_AGE_DAYS;
  if (age > maxAge) return { ok: false, error: `Entries older than ${maxAge} days are not accepted.` };

  const flags: string[] = [];
  if (steps > FLAG_ABOVE_STEPS) flags.push("very_high_count");

  const baseline = median(input.recentSteps.filter((n) => n > 0).slice(0, 14));
  if (input.recentSteps.length >= 3 && baseline > 0 && steps > 20_000 && steps > baseline * 3) {
    flags.push("spike_vs_history");
  }
  // Hand-typed numbers tend to be round; real pedometers almost never are.
  if (source === "manual_demo" && steps >= 5_000 && steps % 1000 === 0) flags.push("round_number");

  return { ok: true, flags };
}

/**
 * Where a new entry starts in the review workflow. Browser submissions are
 * never verified automatically, whatever their content.
 */
export function initialVerification(source: StepSource, flags: string[]): "unverified" | "verified" | "flagged" {
  if (flags.length) return "flagged";
  if (source === "manual_demo") return "unverified";
  return "verified";
}
