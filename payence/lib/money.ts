/**
 * Money is integers. Every amount in the system is a bigint of base units
 * (USDC has 6 decimals, so 1 USDC = 1_000_000n) carried as a decimal string in
 * the database. Floating point never touches a balance.
 */

export type Amount = bigint;

const DEC = /^\d+(\.\d+)?$/;

/** "12.50" with 6 decimals -> 12500000n. Throws on malformed input. */
export function parseAmount(input: string, decimals: number): Amount {
  const s = input.trim().replace(/,/g, "");
  if (!DEC.test(s)) throw new Error("Invalid amount");
  const [whole, frac = ""] = s.split(".");
  if (frac.length > decimals) throw new Error(`At most ${decimals} decimal places`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
}

/** 12500000n with 6 decimals -> "12.5" (trailing zeros trimmed unless `fixed`). */
export function formatUnits(value: Amount, decimals: number, fixed?: number): string {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, "0");
  if (fixed !== undefined) frac = frac.slice(0, fixed).padEnd(fixed, "0");
  else frac = frac.replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

export function toDb(value: Amount): string {
  return value.toString();
}

export function fromDb(value: string | null | undefined): Amount {
  return value ? BigInt(value) : 0n;
}

/** Basis-point fee, rounded up so the platform never under-collects by a unit. */
export function feeOf(amount: Amount, bps: number): Amount {
  if (bps <= 0) return 0n;
  const n = amount * BigInt(bps);
  return n / 10_000n + (n % 10_000n === 0n ? 0n : 1n);
}

/**
 * Convert between two integer-scaled amounts through a decimal rate given as a
 * string ("0.9213"). Rounds half up at the target scale.
 */
export function convert(
  amount: Amount,
  fromDecimals: number,
  toDecimals: number,
  rate: string
): Amount {
  const RATE_SCALE = 12;
  const r = parseAmount(rate, RATE_SCALE);
  const num = amount * r * 10n ** BigInt(toDecimals);
  const den = 10n ** BigInt(fromDecimals + RATE_SCALE);
  const q = num / den;
  const rem = num % den;
  return rem * 2n >= den ? q + 1n : q;
}

/** Locale formatting for fiat display: "€1,234.56". Fiat is stored in cents. */
export function formatFiat(cents: Amount, currency: string, locale = "en-IE"): string {
  const n = Number(cents) / 100;
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

/** "1,234.56 USDC" with two decimals shown by default, more when needed. */
export function formatAsset(value: Amount, decimals: number, symbol: string, show = 2): string {
  const s = formatUnits(value, decimals);
  const [w, f = ""] = s.replace("-", "").split(".");
  const whole = Number(w).toLocaleString("en-US");
  const frac = f.length > show ? f : f.padEnd(show, "0");
  return `${value < 0n ? "-" : ""}${whole}${frac ? "." + frac : ""} ${symbol}`;
}
