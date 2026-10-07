// Native ETH payouts: the token representation, the dollar to wei conversion and
// the checks a plain value transfer must pass. No imports, so it runs anywhere
// (browser, server and the node test runner).

/**
 * Stand in address for a chain's native coin (ETH on Robinhood Chain), the usual
 * 0xEeee…EEeE convention. No contract lives there: payouts in it are plain value
 * transfers. Always compare it lowercased.
 */
export const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;
export const NATIVE_DECIMALS = 18;

export function isNativeToken(address: string | null | undefined): boolean {
  return typeof address === "string" && address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
}

/** Parses a non negative decimal string into an integer scaled by 10^decimals, dropping (not rounding) extra digits. */
function toScaled(value: string, decimals: number): bigint {
  const m = /^(\d+)(?:\.(\d*))?$/.exec(value.trim());
  if (!m) throw new Error(`Not a decimal amount: ${value}`);
  return BigInt(m[1] + (m[2] ?? "").padEnd(decimals, "0").slice(0, decimals));
}

/**
 * Converts a dollar amount to wei at an ETH/USD price, both decimal strings.
 * Rounds down to the wei, so a payout never sends more than the dollars it owes.
 */
export function usdToWei(usd: string, ethUsdPrice: string): bigint {
  const price = toScaled(ethUsdPrice, 18);
  if (price <= 0n) throw new Error("The ETH price must be above zero.");
  return toScaled(usd, 36) / price;
}

/** Wei as an exact ETH decimal string (no trailing zeros), e.g. 1234500000000000n → "0.0012345". */
export function weiToEth(wei: bigint): string {
  if (wei < 0n) throw new Error("Negative amount");
  const s = wei.toString().padStart(NATIVE_DECIMALS + 1, "0");
  const int = s.slice(0, -NATIVE_DECIMALS);
  const frac = s.slice(-NATIVE_DECIMALS).replace(/0+$/, "");
  return frac ? `${int}.${frac}` : int;
}

/** An ETH amount for people: four significant digits below 1 ETH ("0.001234"), four decimals above. */
export function fmtEth(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n) || n === 0) return "0";
  return n < 1
    ? n.toLocaleString("en-US", { maximumSignificantDigits: 4 })
    : n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/** The facts of a native transaction as read from the payout chain. */
export interface NativeTransferFacts {
  from: string;
  to: string | null;
  value: bigint;
  chainId?: number | null;
}

/** What a native payout expects its transaction to be. */
export interface NativePayoutExpectation {
  walletAddress: string;
  amountUnits: string;
  /** The sender recorded when the admin submitted the hash. */
  fromAddress: string | null;
  chainId: number;
  payoutWallets: string[];
}

/**
 * Why a successful native transaction does not pay this payout, or null when it
 * matches exactly: sent by the recorded, authorised payout wallet, straight to the
 * walker's wallet, for exactly the quoted wei, on the payout network.
 */
export function nativeTransferProblem(tx: NativeTransferFacts, expected: NativePayoutExpectation): string | null {
  const from = tx.from.toLowerCase();
  if (!expected.fromAddress || from !== expected.fromAddress.toLowerCase()) return "sender differs from the recorded wallet";
  if (!expected.payoutWallets.map((w) => w.toLowerCase()).includes(from)) return "sender is not an authorised payout wallet";
  if (!tx.to || tx.to.toLowerCase() !== expected.walletAddress.toLowerCase()) return "recipient";
  if (tx.value !== BigInt(expected.amountUnits)) return "amount";
  if (tx.chainId != null && tx.chainId !== expected.chainId) return "network";
  return null;
}
