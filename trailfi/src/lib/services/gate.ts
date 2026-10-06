import "server-only";
import { formatUnits, parseUnits } from "viem";
import { HttpError } from "@/lib/api";
import { isAdminWallet } from "@/lib/auth/guard";
import { publicClient } from "@/lib/web3/server";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { getSettings } from "./settings";

export interface TokenCheck {
  ok: boolean;
  symbol: string;
  /** Balance and minimum in whole tokens, as decimal strings. */
  balance: string;
  min: string;
}

/**
 * Whether a wallet holds enough of the payout token (USDG on Robinhood Chain)
 * to cash out. MIN_TOKEN_TO_JOIN sets the minimum; by default any balance above
 * zero is enough. Throws 503 when the chain can't be reached.
 */
export async function checkPayoutToken(address: `0x${string}`): Promise<TokenCheck> {
  const settings = await getSettings();
  const min = parseUnits(process.env.MIN_TOKEN_TO_JOIN || "0", settings.payoutTokenDecimals);
  let balance: bigint;
  try {
    balance = await publicClient().readContract({
      address: settings.payoutTokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    });
  } catch {
    throw new HttpError(503, `Could not check your ${settings.payoutTokenSymbol} balance right now. Please try again.`, "balance_unavailable");
  }
  return {
    ok: balance > 0n && balance >= min,
    symbol: settings.payoutTokenSymbol,
    balance: formatUnits(balance, settings.payoutTokenDecimals),
    min: formatUnits(min, settings.payoutTokenDecimals),
  };
}

/**
 * Joining is free; cashing out needs a wallet that holds the payout token. It keeps
 * farms of empty wallets from draining rewards. Admin wallets skip the check.
 */
export async function assertHoldsPayoutToken(address: `0x${string}`, who: "self" | "walker" = "self") {
  if (isAdminWallet(address)) return;
  const check = await checkPayoutToken(address);
  if (!check.ok) {
    const need = Number(check.min) > 0 ? `at least ${check.min} ${check.symbol}` : check.symbol;
    throw new HttpError(
      403,
      who === "self"
        ? `To cash out, your wallet needs ${need} on Robinhood Chain. It stays in your wallet; add a little and request again.`
        : `This walker's wallet holds no ${check.symbol} on Robinhood Chain yet, so it can't be paid until it does.`,
      "token_required",
    );
  }
}
