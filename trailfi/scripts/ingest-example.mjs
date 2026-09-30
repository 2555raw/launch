// Example client for the signed step-ingestion endpoint, as the backend of the
// iOS (HealthKit) / Android (Health Connect) companion app would call it.
//
// Usage:
//   STEP_INGEST_SECRET=… node scripts/ingest-example.mjs 0xYourWallet 11234 [YYYY-MM-DD] [apple_health|health_connect]
import { createHmac } from "node:crypto";

const [wallet, steps, day = new Date().toISOString().slice(0, 10), source = "apple_health"] = process.argv.slice(2);
const secret = process.env.STEP_INGEST_SECRET;
const base = process.env.APP_URL || "http://localhost:3000";
if (!wallet || !steps || !secret) {
  console.error("Usage: STEP_INGEST_SECRET=… node scripts/ingest-example.mjs <wallet> <steps> [day] [source]");
  process.exit(1);
}

const body = JSON.stringify({
  wallet,
  source,
  entries: [{ day, steps: Number(steps), externalId: `${source}:${wallet.toLowerCase()}:${day}` }],
});
const timestamp = Math.floor(Date.now() / 1000);
const signature = "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

const res = await fetch(`${base}/api/steps/ingest`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-trailfi-timestamp": String(timestamp), "x-trailfi-signature": signature },
  body,
});
console.log(res.status, await res.text());
