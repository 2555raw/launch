import type { StepSource } from "../validation";

export interface ProviderStepRecord {
  day: string;
  steps: number;
  /** Provider-side identifier used to reject replays/duplicates. */
  externalId: string;
}

/**
 * A source of step data. Apple Health (HealthKit) and Google Health Connect are
 * on-device APIs with no web endpoint, so both reach Strydo through a
 * companion mobile app that reads the data on the phone and posts it to
 * /api/steps/ingest, signed. Cloud fitness APIs (Fitbit, Garmin, Strava…) fit
 * the same shape through a server-side OAuth connector.
 */
export interface StepProvider {
  source: StepSource;
  label: string;
  status: "live" | "companion-app" | "planned" | "demo";
  description: string;
  /** Trusted providers produce entries that start as verified (unless flagged). */
  trusted: boolean;
}
