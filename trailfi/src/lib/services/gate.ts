import "server-only";
import { formatUnits, parseUnits } from "viem";
import { HttpError } from "@/lib/api";
import { publicClient } from "@/lib/web3/server";
import { ERC20_ABI, isNativeToken } from "@/lib/web3/tokens";
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
    balance = isNativeToken(settings.payoutTokenAddress)
      ? await publicClient().getBalance({ address })
      : await publicClient().readContract({
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
