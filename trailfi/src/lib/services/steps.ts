import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { one, query } from "@/lib/db";
import { checkStepSubmission, initialVerification, utcToday, type StepSource } from "@/lib/steps/validation";

export interface StepEntry {
  id: string;
  day: string;
  steps: number;
  source: StepSource;
  verification: "unverified" | "verified" | "flagged" | "rejected";
  flags: string[];
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
}

const ENTRY_COLUMNS = `id, day::text as day, steps, source, verification, flags, reviewed_by as "reviewedBy",
  review_note as "reviewNote", created_at as "createdAt"`;

async function recentSteps(userId: string, excludeDay: string): Promise<number[]> {
  const rows = await query<{ steps: number }>(
    `select max(steps) as steps from step_entries
      where user_id = $1 and day <> $2::date and day >= $2::date - 30 and verification <> 'rejected'
      group by day order by day desc limit 14`,
    [userId, excludeDay],
  );
  return rows.map((r) => Number(r.steps));
}

async function insertEntry(opts: {
  userId: string;
  day: string;
  steps: number;
  source: StepSource;
  externalId?: string;
}): Promise<StepEntry> {
  const check = checkStepSubmission({
    day: opts.day,
    steps: opts.steps,
    source: opts.source,
    today: utcToday(),
    recentSteps: await recentSteps(opts.userId, opts.day),
  });
  if (!check.ok) throw new HttpError(422, check.error, "invalid_steps");

  const verification = initialVerification(opts.source, check.flags);
  const payloadHash = createHash("sha256")
    .update(`${opts.userId}|${opts.day}|${opts.steps}|${opts.source}|${opts.externalId ?? ""}`)
    .digest("hex");

  const row = await one<StepEntry>(
    `insert into step_entries (user_id, day, steps, source, verification, flags, external_id, payload_hash)
     values ($1, $2::date, $3, $4, $5, $6, $7, $8)
     on conflict do nothing
     returning ${ENTRY_COLUMNS}`,
    [opts.userId, opts.day, opts.steps, opts.source, verification, check.flags, opts.externalId ?? null, payloadHash],
  );
  if (!row) {
    throw new HttpError(
      409,
      opts.source === "manual_demo"
        ? "You already logged steps for this day. Entries cannot be overwritten."
        : "Duplicate entry: this record was already received.",
      "duplicate",
    );
  }
  return row;
}

export const manualStepsSchema = z.object({
  day: z.string(),
  steps: z.number().int(),
});

/** Browser submission. Always stored as unverified (or flagged) — never payable as-is. */
export async function submitManualSteps(userId: string, input: unknown) {
  const { day, steps } = manualStepsSchema.parse(input);
  return insertEntry({ userId, day, steps, source: "manual_demo" });
}

export const ingestSchema = z.object({
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  source: z.enum(["apple_health", "health_connect", "fitness_api"]),
  entries: z
    .array(z.object({ day: z.string(), steps: z.number().int(), externalId: z.string().min(1).max(200) }))
    .min(1)
    .max(31),
});

/** Signed provider ingestion (companion app / connector). Each record is accepted or rejected on its own. */
export async function ingestProviderSteps(input: unknown) {
  const body = ingestSchema.parse(input);
  const user = await one<{ id: string; status: string }>("select id, status from users where wallet_address = $1", [
    body.wallet.toLowerCase(),
  ]);
  if (!user) throw new HttpError(404, "No TrailFi account for this wallet.", "unknown_wallet");
  if (user.status !== "active") throw new HttpError(403, "Account suspended.", "suspended");

  const results: Array<{ externalId: string; ok: boolean; id?: string; verification?: string; error?: string }> = [];
  for (const e of body.entries) {
    try {
      const row = await insertEntry({ userId: user.id, day: e.day, steps: e.steps, source: body.source, externalId: e.externalId });
      results.push({ externalId: e.externalId, ok: true, id: row.id, verification: row.verification });
    } catch (err) {
      results.push({ externalId: e.externalId, ok: false, error: err instanceof Error ? err.message : "failed" });
    }
  }
  await audit(`ingest:${body.source}`, "steps.ingest", "user", user.id, {
    accepted: results.filter((r) => r.ok).length,
    rejected: results.filter((r) => !r.ok).length,
  });
  return results;
}

export async function listUserSteps(userId: string, days = 60): Promise<StepEntry[]> {
  return query<StepEntry>(
    `select ${ENTRY_COLUMNS} from step_entries where user_id = $1 and day >= current_date - $2::int
     order by day desc, created_at desc`,
    [userId, days],
  );
}

export const reviewSchema = z.object({
  decision: z.enum(["verified", "rejected"]),
  note: z.string().trim().max(300).optional(),
});

/** Manual admin review — the only way a browser-submitted entry becomes payable. */
export async function reviewStepEntry(entryId: string, input: unknown, actor: string) {
  const { decision, note } = reviewSchema.parse(input);
  const rewarded = await one<{ n: number }>(
    `select count(*)::int as n from rewards r join step_entries s on s.user_id = r.user_id
      where s.id = $1 and s.day between r.period_start and r.period_end and r.status <> 'rejected'`,
    [entryId],
  );
  if (rewarded && rewarded.n > 0) {
    throw new HttpError(409, "This day is already part of a reward distribution and can no longer change.", "locked");
  }
  const row = await one<StepEntry>(
    `update step_entries set verification = $2, reviewed_by = $3, reviewed_at = now(), review_note = $4
      where id = $1 returning ${ENTRY_COLUMNS}`,
    [entryId, decision, actor, note ?? null],
  );
  if (!row) throw new HttpError(404, "Step entry not found.", "not_found");
  await audit(actor, `steps.${decision}`, "step_entry", entryId, { note, day: row.day, steps: row.steps });
  return row;
}
