import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, passwordProblem } from "../lib/auth/password";
import { generateSecret, totpCode, verifyTotp, base32Decode, base32Encode } from "../lib/auth/totp";
import { rateLimit } from "../lib/auth/rateLimit";

describe("passwords", () => {
  it("round-trips a hash and rejects the wrong password", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong horse battery", h)).toBe(false);
  });
  it("produces a different hash each time (salted)", async () => {
    expect(await hashPassword("same password here")).not.toBe(await hashPassword("same password here"));
  });
  it("rejects weak passwords", () => {
    expect(passwordProblem("short")).toBeTruthy();
    expect(passwordProblem("password12345")).toBeTruthy();
    expect(passwordProblem("aaaaaaaaaaaa")).toBeTruthy();
    expect(passwordProblem("jane12345678", "jane@example.com")).toBeTruthy();
    expect(passwordProblem("a-decent-passphrase")).toBeNull();
  });
});

describe("totp", () => {
  it("round-trips base32", () => {
    const buf = Buffer.from("hello world");
    expect(base32Decode(base32Encode(buf)).toString()).toBe("hello world");
  });
  it("matches RFC 6238 style codes and tolerates drift", () => {
    const secret = generateSecret();
    const now = Date.now();
    expect(verifyTotp(secret, totpCode(secret, now), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now - 120_000), now)).toBe(false);
    expect(verifyTotp(secret, "000000", now) && totpCode(secret, now) !== "000000").toBe(false);
  });
});

describe("rate limit", () => {
  it("blocks after the limit and reports a retry delay", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 1000).ok).toBe(true);
    const blocked = rateLimit(key, 3, 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});
