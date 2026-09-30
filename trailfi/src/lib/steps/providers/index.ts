import type { StepSource } from "../validation";
import type { StepProvider } from "./types";

export type { StepProvider, ProviderStepRecord } from "./types";

export const STEP_PROVIDERS: Record<StepSource, StepProvider> = {
  manual_demo: {
    source: "manual_demo",
    label: "Manual entry (demo)",
    status: "demo",
    description:
      "Typed in the browser. Stored as unverified and never counted for real payouts until an admin reviews it.",
    trusted: false,
  },
  apple_health: {
    source: "apple_health",
    label: "Apple Health",
    status: "companion-app",
    description:
      "Read with HealthKit (HKStatisticsQuery, stepCount) in the TrailFi iOS companion app and posted to the signed ingest endpoint.",
    trusted: true,
  },
  health_connect: {
    source: "health_connect",
    label: "Google Health Connect",
    status: "companion-app",
    description:
      "Read with the Health Connect API (StepsRecord aggregate) in the TrailFi Android companion app and posted to the signed ingest endpoint.",
    trusted: true,
  },
  fitness_api: {
    source: "fitness_api",
    label: "Fitness cloud API",
    status: "planned",
    description: "Server-side OAuth connector for wearables clouds (Fitbit, Garmin, Oura). Same ingest contract.",
    trusted: true,
  },
};
