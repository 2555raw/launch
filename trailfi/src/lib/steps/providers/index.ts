import type { StepSource } from "../validation";
import type { StepProvider } from "./types";

export type { StepProvider, ProviderStepRecord } from "./types";

export const STEP_PROVIDERS: Record<StepSource, StepProvider> = {
  manual_demo: {
    source: "manual_demo",
    label: "Upload with screenshot",
    status: "live",
    description:
      "Daily steps uploaded from the browser with a screenshot of the health app. Stored as unverified and never paid until the team checks the screenshot.",
    trusted: false,
  },
  apple_health: {
    source: "apple_health",
    label: "Apple Health",
    status: "companion-app",
    description:
      "Read with HealthKit (HKStatisticsQuery, stepCount) in the Strydo iOS companion app and posted to the signed ingest endpoint.",
    trusted: true,
  },
  health_connect: {
    source: "health_connect",
    label: "Google Health Connect",
    status: "companion-app",
    description:
      "Read with the Health Connect API (StepsRecord aggregate) in the Strydo Android companion app and posted to the signed ingest endpoint.",
    trusted: true,
  },
  fitness_api: {
    source: "fitness_api",
    label: "Fitness cloud API",
    status: "planned",
    description: "Server side OAuth connector for wearables clouds (Fitbit, Garmin, Oura). Same ingest contract.",
    trusted: true,
  },
};
