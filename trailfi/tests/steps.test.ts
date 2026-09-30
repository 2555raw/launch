import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStepSubmission, initialVerification } from "../src/lib/steps/validation.ts";
import { signIngestPayload, verifyIngestSignature } from "../src/lib/steps/signature.ts";

const base = { source: "manual_demo" as const, today: "2026-09-30", recentSteps: [] as number[] };

test("accepts a normal submission", () => {
  const r = checkStepSubmission({ ...base, day: "2026-09-30", steps: 10_482 });
  assert.deepEqual(r, { ok: true, flags: [] });
});

test("rejects malformed input, future dates and stale manual entries", () => {
  assert.equal(checkStepSubmission({ ...base, day: "30/09/2026", steps: 1 }).ok, false);
  assert.equal(checkStepSubmission({ ...base, day: "2026-09-30", steps: -5 }).ok, false);
  assert.equal(checkStepSubmission({ ...base, day: "2026-09-30", steps: 1.5 }).ok, false);
  assert.equal(checkStepSubmission({ ...base, day: "2026-09-30", steps: 150_000 }).ok, false);
  assert.equal(checkStepSubmission({ ...base, day: "2026-10-05", steps: 1 }).ok, false);
  assert.equal(checkStepSubmission({ ...base, day: "2026-09-01", steps: 1 }).ok, false);
  // Provider data may be older than manual data.
  assert.equal(checkStepSubmission({ ...base, source: "apple_health", day: "2026-09-15", steps: 1 }).ok, true);
});

test("flags suspicious values", () => {
  const high = checkStepSubmission({ ...base, day: "2026-09-30", steps: 60_123 });
  assert.ok(high.ok && high.flags.includes("very_high_count"));
  const spike = checkStepSubmission({ ...base, day: "2026-09-30", steps: 30_123, recentSteps: [6_000, 7_000, 8_000, 5_500] });
  assert.ok(spike.ok && spike.flags.includes("spike_vs_history"));
  const round = checkStepSubmission({ ...base, day: "2026-09-30", steps: 12_000 });
  assert.ok(round.ok && round.flags.includes("round_number"));
});

test("browser submissions are never auto-verified", () => {
  assert.equal(initialVerification("manual_demo", []), "unverified");
  assert.equal(initialVerification("apple_health", []), "verified");
  assert.equal(initialVerification("apple_health", ["very_high_count"]), "flagged");
});

test("ingest signatures are checked for secret, body and freshness", () => {
  const secret = "s3cret";
  const body = JSON.stringify({ hello: "world" });
  const now = 1_800_000_000;
  const signature = signIngestPayload(secret, now, body);
  assert.deepEqual(verifyIngestSignature({ secret, rawBody: body, timestamp: String(now), signature, now }), { ok: true });
  assert.equal(verifyIngestSignature({ secret, rawBody: body + " ", timestamp: String(now), signature, now }).ok, false);
  assert.equal(verifyIngestSignature({ secret: "other", rawBody: body, timestamp: String(now), signature, now }).ok, false);
  assert.equal(verifyIngestSignature({ secret, rawBody: body, timestamp: String(now - 3600), signature, now }).ok, false);
  assert.equal(verifyIngestSignature({ secret: "", rawBody: body, timestamp: String(now), signature, now }).ok, false);
});
