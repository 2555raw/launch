import { HttpError, clientIp, json, rateLimit, route } from "@/lib/api";
import { env } from "@/lib/env";
import { ingestProviderSteps } from "@/lib/services/steps";
import { verifyIngestSignature } from "@/lib/steps/signature";

export const dynamic = "force-dynamic";

/**
 * Signed ingestion endpoint for trusted step sources: the iOS (HealthKit) and
 * Android (Health Connect) companion apps' backend, or a fitness-cloud connector.
 * See README → "Step data integration" for the contract.
 */
export const POST = route(async (req) => {
  rateLimit(`ingest:${clientIp(req)}`, 120, 60_000);
  const rawBody = await req.text();
  const check = verifyIngestSignature({
    secret: env.stepIngestSecret,
    rawBody,
    timestamp: req.headers.get("x-trailfi-timestamp"),
    signature: req.headers.get("x-trailfi-signature"),
  });
  if (!check.ok) throw new HttpError(401, check.error, "bad_signature");
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new HttpError(400, "Body must be JSON.", "invalid_json");
  }
  return json({ results: await ingestProviderSteps(body) });
});
