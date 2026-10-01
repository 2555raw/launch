import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { one, query, tx } from "@/lib/db";
import { tierReward } from "@/lib/rewards/engine";
import { checkStepSubmission, initialVerification, utcToday, type StepSource } from "@/lib/steps/validation";
import { creditReferralBonus } from "./referrals";
import { getSettings, toTiers } from "./settings";

export interface StepEntry {
  id: string;
  day: string;
  steps: number;
  source: StepSource;
  verification: "unverified" | "verified" | "flagged" | "rejected";
  flags: string[];
  reviewedBy: string | null;
  reviewNote: string | null;
  hasProof: boolean;
  createdAt: string;
}

const ENTRY_COLUMNS = `id, day::text as day, steps, source, verification, flags, reviewed_by as "reviewedBy",
  review_note as "reviewNote", proof_image is not null as "hasProof", created_at as "createdAt"`;

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
  proof?: string;
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
    `insert into step_entries (user_id, day, steps, source, verification, flags, external_id, payload_hash, proof_image)
     values ($1, $2::date, $3, $4, $5, $6, $7, $8, $9)
     on conflict do nothing
     returning ${ENTRY_COLUMNS}`,
    [opts.userId, opts.day, opts.steps, opts.source, verification, check.flags, opts.externalId ?? null, payloadHash, opts.proof ?? null],
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

/** Compressed screenshots stay well under this; it bounds what a single entry can store. */
export const PROOF_MAX_CHARS = 1_600_000;

export const manualStepsSchema = z.object({
  day: z.string(),
  steps: z.number().int(),
  proof: z
    .string({ error: "Attach a screenshot of your health app showing the date and your steps." })
    .max(PROOF_MAX_CHARS, "Screenshot is too large. Try a smaller image.")
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/, "Attach a screenshot of your health app (JPG, PNG or WebP)."),
});

/** Browser upload with a screenshot. Always stored as unverified (or flagged) — never payable until reviewed. */
export async function submitManualSteps(userId: string, input: unknown) {
  const { day, steps, proof } = manualStepsSchema.parse(input);
  return insertEntry({ userId, day, steps, source: "manual_demo", proof });
}

/**
 * Lets a walker take back an upload the team has not reviewed yet (a typo, the
 * wrong screenshot) so the day can be uploaded again. Reviewed entries stay.
 */
export async function deleteOwnUpload(userId: string, wallet: string, entryId: string) {
  const row = await one<{ day: string; steps: number }>(
    `delete from step_entries
      where id = $1 and user_id = $2 and source = 'manual_demo' and verification in ('unverified', 'flagged')
      returning day::text as day, steps`,
    [entryId, userId],
  );
  if (!row) throw new HttpError(409, "Only uploads still waiting for review can be deleted.", "not_deletable");
  await audit(wallet, "steps.delete_own", "step_entry", entryId, row);
  return row;
}

/** The screenshot attached to an entry, for the admin review. */
export async function getStepProof(entryId: string): Promise<string | null> {
  const row = await one<{ proof: string | null }>("select proof_image as proof from step_entries where id = $1", [entryId]);
  if (!row) throw new HttpError(404, "Step entry not found.", "not_found");
  return row.proof;
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
  if (!user) throw new HttpError(404, "No Stepit account for this wallet.", "unknown_wallet");
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
  const settings = await getSettings();
  const { row, reward } = await tx(async (q) => {
    const [rewarded] = await q.query<{ n: number }>(
      `select count(*)::int as n from rewards r join step_entries s on s.user_id = r.user_id
        where s.id = $1 and s.day between r.period_start and r.period_end and r.status <> 'rejected'`,
      [entryId],
    );
    if (rewarded && rewarded.n > 0) {
      throw new HttpError(409, "This day already has a reward and can no longer change.", "locked");
    }
    const [row] = await q.query<StepEntry & { userId: string }>(
      `update step_entries set verification = $2, reviewed_by = $3, reviewed_at = now(), review_note = $4
        where id = $1 returning ${ENTRY_COLUMNS}, user_id as "userId"`,
      [entryId, decision, actor, note ?? null],
    );
    if (!row) throw new HttpError(404, "Step entry not found.", "not_found");

    // A verified day is credited right away at the current rates, ready for the walker to request.
    let reward: number | null = null;
    if (decision === "verified") {
      const amount = tierReward(row.steps, toTiers(settings));
      if (amount > 0) {
        await q.query(
          `insert into rewards (user_id, step_entry_id, period_start, period_end, valid_steps, eligible_days, weight, amount,
                                token_symbol, status, reviewed_by, reviewed_at)
           values ($1, $2, $3::date, $3::date, $4::int, 1, $5::numeric, $6::numeric, $7, 'approved', $8, now())`,
          [row.userId, entryId, row.day, row.steps, row.steps, amount, settings.payoutTokenSymbol, actor],
        );
        reward = amount;
      }
      await creditReferralBonus(q, row.userId, row.day, settings.referralBonus, settings.payoutTokenSymbol, actor);
    }
    await audit(actor, `steps.${decision}`, "step_entry", entryId, { note, day: row.day, steps: row.steps, reward }, q);
    return { row, reward };
  });
  const { userId: _userId, ...entry } = row;
  void _userId;
  return { ...entry, reward };
}

/** What a public share link shows: the day and the step count, never the wallet. */
export async function getShareEntry(entryId: string): Promise<{ day: string; steps: number } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) return null;
  return one<{ day: string; steps: number }>(
    "select day::text as day, steps from step_entries where id = $1 and verification <> 'rejected'",
    [entryId],
  );
}
