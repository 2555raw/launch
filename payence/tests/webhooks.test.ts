import { describe, it, expect } from "vitest";
import { signPayload, verifySignature } from "../lib/services/webhooks";

describe("webhook signatures", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ type: "payment.completed", amount: "1000000" });

  it("verifies a signature it produced", () => {
    expect(verifySignature(secret, body, signPayload(secret, body))).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifySignature(secret, body + " ", signPayload(secret, body))).toBe(false);
  });
  it("rejects the wrong secret", () => {
    expect(verifySignature("whsec_other", body, signPayload(secret, body))).toBe(false);
  });
  it("rejects a replay outside the tolerance window", () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    expect(verifySignature(secret, body, signPayload(secret, body, old))).toBe(false);
  });
});
