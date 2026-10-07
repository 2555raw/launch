import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { one, query } from "@/lib/db";

/** What Claude reads off a health app screenshot. */
const Reading = z.object({
  readable: z.boolean(),
  steps: z.number().int().nullable(),
  date: z.string().nullable(),
  app: z.string().nullable(),
  note: z.string(),
});

const PROMPT = `This is a screenshot a walker uploaded as proof of their daily steps, usually from Apple Health, Apple Fitness, Google Fit, Samsung Health, Fitbit or Garmin.

Read the single day's total step count and the date it belongs to.
- steps: the day's total steps as an integer, or null if no step total is visible.
- date: that day as YYYY-MM-DD. Screenshots often show "Today" or a weekday without a year: resolve it relative to the upload date given below. Null if no date can be worked out.
- app: which app it looks like, or null.
- readable: false when the image is not a health or fitness app screen, or the numbers can't be read.
- note: one short sentence on anything odd (edited look, weekly total instead of a day, several days shown). Empty string if nothing stands out.`;

/** Steps may differ a little between what the walker typed and what the photo shows (rounding, a later sync). */
const STEP_TOLERANCE = 0.03;

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

/** Reading runs only when an Anthropic key is configured; without it uploads are simply reviewed by eye. */
export const screenshotReadingEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

/**
 * Reads one upload's screenshot and stores the result next to the entry. Never throws: a failure is
 * recorded as status 'error' and the admin reviews that upload by eye as before.
 */
export async function readScreenshot(entryId: string): Promise<void> {
  if (!screenshotReadingEnabled()) return;
  const entry = await one<{ proof: string | null; steps: number; day: string; createdAt: string }>(
    `select proof_image as proof, steps, day::text as day, created_at::date::text as "createdAt"
       from step_entries where id = $1 and ocr_status is null`,
    [entryId],
  );
  if (!entry?.proof) return;
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(entry.proof);
  if (!m) return;

  try {
    const response = await anthropic().messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(Reading) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg" | "image/png" | "image/webp", data: m[2] } },
            { type: "text", text: `${PROMPT}\n\nUploaded on ${entry.createdAt}.` },
          ],
        },
      ],
    });
    const r = response.parsed_output;
    if (response.stop_reason === "refusal" || !r) {
      await save(entryId, "error", null, null, "The screenshot could not be read automatically.");
      return;
    }
    if (!r.readable || r.steps === null) {
      await save(entryId, "unreadable", r.steps, validDay(r.date), r.note || "No daily step total visible in the screenshot.");
      return;
    }
    const day = validDay(r.date);
    const stepsOk = Math.abs(r.steps - entry.steps) <= Math.max(50, entry.steps * STEP_TOLERANCE);
    const dayOk = day === null || day === entry.day;
    const problems = [
      !stepsOk && `photo shows ${r.steps.toLocaleString("en-US")} steps, walker typed ${entry.steps.toLocaleString("en-US")}`,
      !dayOk && `photo is for ${day}, upload is for ${entry.day}`,
      day === null && "no date visible in the photo",
    ].filter(Boolean);
    const note = [problems.join("; "), r.note].filter(Boolean).join(". ");
    await save(entryId, stepsOk && dayOk ? "match" : "mismatch", r.steps, day, note || null);
  } catch (e) {
    await save(entryId, "error", null, null, `Automatic reading failed: ${(e as Error).message.slice(0, 120)}`);
  }
}

function validDay(d: string | null): string | null {
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

async function save(id: string, status: string, steps: number | null, day: string | null, note: string | null) {
  await query("update step_entries set ocr_status = $2, ocr_steps = $3, ocr_day = $4::date, ocr_note = $5 where id = $1", [id, status, steps, day, note]);
}

/** Reads any queued uploads that were never read (e.g. after a restart), a few at a time. */
export async function readPendingScreenshots(limit = 5) {
  if (!screenshotReadingEnabled()) return;
  const rows = await query<{ id: string }>(
    `select id from step_entries
      where ocr_status is null and proof_image is not null and verification in ('unverified', 'flagged')
      order by created_at desc limit $1`,
    [limit],
  );
  for (const r of rows) await readScreenshot(r.id);
}
