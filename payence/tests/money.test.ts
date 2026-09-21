import { describe, it, expect } from "vitest";
import { parseAmount, formatUnits, feeOf, convert, formatAsset } from "../lib/money";

describe("money", () => {
  it("parses decimals into base units", () => {
    expect(parseAmount("12.5", 6)).toBe(12_500_000n);
    expect(parseAmount("0.000001", 6)).toBe(1n);
    expect(parseAmount("1,000", 6)).toBe(1_000_000_000n);
    expect(() => parseAmount("1.2345678", 6)).toThrow();
    expect(() => parseAmount("abc", 6)).toThrow();
    expect(() => parseAmount("-1", 6)).toThrow();
  });
  it("formats base units", () => {
    expect(formatUnits(12_500_000n, 6)).toBe("12.5");
    expect(formatUnits(12_500_000n, 6, 2)).toBe("12.50");
    expect(formatUnits(-1n, 6)).toBe("-0.000001");
    expect(formatAsset(1_234_560_000n, 6, "USDC")).toBe("1,234.56 USDC");
  });
  it("rounds fees up", () => {
    expect(feeOf(1_000_000n, 50)).toBe(5_000n); // 0.5%
    expect(feeOf(1n, 50)).toBe(1n);
    expect(feeOf(1_000_000n, 0)).toBe(0n);
  });
  it("converts through a decimal rate", () => {
    expect(convert(100_000_000n, 6, 6, "0.92")).toBe(92_000_000n); // 100 USDC -> 92 EURC
    expect(convert(100_000_000n, 6, 2, "1")).toBe(10_000n); // 100 USDC -> 10000 cents
    expect(convert(1n, 6, 2, "0.5")).toBe(0n);
  });
});
