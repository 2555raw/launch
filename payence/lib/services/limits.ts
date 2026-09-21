import { and, eq, gte, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { TIER_LIMITS } from "@/lib/providers/compliance";
import { fromDb } from "@/lib/money";

/**
 * Spending limits. Every outbound movement passes through here before the
 * ledger is touched: a tier ceiling the user cannot raise without verifying,
 * and a self-imposed daily cap they can set lower.
 */

export type LimitCheck =
  | { ok: true; remainingDaily: bigint }
  | { ok: false; code: "PER_TRANSACTION" | "DAILY" | "MONTHLY" | "SELF"; message: string; limitCents: bigint };

function spentSince(userId: string, since: number): bigint {
  const t = schema.transactions;
  const row = getDb()
    .select({ total: sql<string>`coalesce(sum(cast(${t.fiatAmount} as integer)), 0)` })
    .from(t)
    .where(
      and(
        eq(t.fromType, "user"),
        eq(t.fromId, userId),
        gte(t.createdAt, since),
        or(eq(t.status, "completed"), eq(t.status, "processing"), eq(t.status, "pending"))
      )
    )
    .get();
  return BigInt(row?.total ?? "0");
}

export function tierOf(user: schema.User) {
  return TIER_LIMITS[user.kycTier] ?? TIER_LIMITS[0];
}

/** `fiatCents` is the value of the movement in the user's display currency. */
export function checkLimits(user: schema.User, fiatCents: bigint): LimitCheck {
  const tier = tierOf(user);
  if (fiatCents > tier.perTransaction) {
    return {
      ok: false,
      code: "PER_TRANSACTION",
      message: `Single payments are capped at ${money(tier.perTransaction)} on your current level.`,
      limitCents: tier.perTransaction,
    };
  }
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const spentToday = spentSince(user.id, dayStart.getTime());
  const selfCap = user.dailyLimitCents ? BigInt(user.dailyLimitCents) : null;
  if (selfCap !== null && spentToday + fiatCents > selfCap) {
    return {
      ok: false,
      code: "SELF",
      message: `This would pass the daily limit you set (${money(selfCap)}).`,
      limitCents: selfCap,
    };
  }
  if (spentToday + fiatCents > tier.daily) {
    return {
      ok: false,
      code: "DAILY",
      message: `This would pass your daily limit of ${money(tier.daily)}.`,
      limitCents: tier.daily,
    };
  }
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  if (spentSince(user.id, monthStart.getTime()) + fiatCents > tier.monthly) {
    return {
      ok: false,
      code: "MONTHLY",
      message: `This would pass your monthly limit of ${money(tier.monthly)}.`,
      limitCents: tier.monthly,
    };
  }
  const effectiveDaily = selfCap !== null && selfCap < tier.daily ? selfCap : tier.daily;
  return { ok: true, remainingDaily: effectiveDaily - spentToday - fiatCents };
}

export function limitUsage(user: schema.User) {
  const tier = tierOf(user);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const selfCap = user.dailyLimitCents ? BigInt(user.dailyLimitCents) : null;
  const daily = selfCap !== null && selfCap < tier.daily ? selfCap : tier.daily;
  return {
    tier,
    dailyLimit: daily,
    dailyUsed: spentSince(user.id, dayStart.getTime()),
    monthlyLimit: tier.monthly,
    monthlyUsed: spentSince(user.id, monthStart.getTime()),
    selfCap,
  };
}

function money(cents: bigint): string {
  return `€${(Number(cents) / 100).toLocaleString("en-IE", { minimumFractionDigits: 2 })}`;
}

export { fromDb };
