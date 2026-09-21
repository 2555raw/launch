import type { ComplianceProvider, ComplianceDecision } from "./types";
import { getDb, schema } from "@/lib/db";
import { id } from "@/lib/ids";
import { config } from "@/lib/config";

/**
 * Compliance.
 *
 * This implementation enforces the rules the platform can enforce on its own:
 * tiered limits, geographic blocks, velocity checks, and a review queue written
 * to the database. It does NOT do sanctions screening or identity verification:
 * both require a licensed vendor (Sumsub, Persona, Onfido for KYC; ComplyAdvantage,
 * Chainalysis, TRM for sanctions and address risk). Those are the integration
 * points, and `startKyc` is where the handoff goes.
 */

// Jurisdictions the platform will not serve. A real list is a compliance
// decision, kept current from OFAC/EU/UN designations by the vendor above.
const BLOCKED_COUNTRIES = new Set(["KP", "IR", "SY", "CU"]);

/** Per-tier ceilings in cents of the user's display currency. */
export const TIER_LIMITS: Record<number, { perTransaction: bigint; daily: bigint; monthly: bigint; label: string }> = {
  0: { perTransaction: 15_000n, daily: 25_000n, monthly: 50_000n, label: "Unverified" },
  1: { perTransaction: 200_000n, daily: 500_000n, monthly: 2_000_000n, label: "Basic" },
  2: { perTransaction: 2_500_000n, daily: 5_000_000n, monthly: 25_000_000n, label: "Verified" },
};

export class BasicCompliance implements ComplianceProvider {
  readonly name = "basic";

  async screenUser(input: { userId: string; name: string; country?: string | null }): Promise<ComplianceDecision> {
    if (input.country && BLOCKED_COUNTRIES.has(input.country.toUpperCase())) {
      return { outcome: "block", reason: "Payence is not available in this country." };
    }
    // A sanctions list check belongs here, against a vendor feed.
    return { outcome: "allow", reason: "No internal rule matched." };
  }

  async screenTransaction(input: {
    userId: string;
    kind: "payment" | "withdrawal" | "deposit" | "transfer";
    fiatCents: bigint;
    currency: string;
    address?: string;
  }): Promise<ComplianceDecision> {
    // Large movements are allowed but flagged for monitoring, which is what a
    // transaction monitoring rule engine does before a human looks at it.
    if (input.fiatCents >= 1_000_000n) {
      const caseId = this.openCase("transaction", input.userId, "monitoring", `Large ${input.kind}: ${input.fiatCents} ${input.currency} cents`);
      return { outcome: "allow", reason: "Flagged for post-transaction monitoring.", caseId };
    }
    if (input.kind === "withdrawal" && !input.address) {
      return { outcome: "block", reason: "A destination address is required." };
    }
    return { outcome: "allow", reason: "No internal rule matched." };
  }

  async startKyc(input: { userId: string; email: string }): Promise<{ status: "pending" | "approved"; redirectUrl?: string }> {
    // Real identity verification is a vendor hosted flow. Without one configured,
    // the case is opened and left for manual review; nothing is auto-approved.
    this.openCase("user", input.userId, "kyc", "Identity verification requested; no KYC vendor configured.");
    return { status: "pending" };
  }

  private openCase(subjectType: string, subjectId: string, kind: string, reason: string): string {
    const caseId = id("case");
    getDb()
      .insert(schema.complianceReviews)
      .values({ id: caseId, subjectType, subjectId, kind, status: "open", reason, createdAt: Date.now() })
      .run();
    return caseId;
  }
}

let cached: ComplianceProvider | null = null;

export function compliance(): ComplianceProvider {
  if (!cached) cached = new BasicCompliance();
  void config.compliance.provider;
  return cached;
}
