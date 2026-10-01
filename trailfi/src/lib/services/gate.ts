import "server-only";
import { formatUnits, parseUnits } from "viem";
import { HttpError } from "@/lib/api";
import { isAdminWallet } from "@/lib/auth/guard";
import { publicClient } from "@/lib/web3/server";
import { ERC20_ABI } from "@/lib/web3/tokens";
import { getSettings } from "./settings";

/**
 * Only wallets that hold the payout token (USDG on Robinhood Chain) can join.
 * MIN_TOKEN_TO_JOIN sets the minimum; by default any balance above zero is
 * enough. Admin wallets skip the check.
 */
export async function assertHoldsPayoutToken(address: `0x${string}`) {
  if (isAdminWallet(address)) return;
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
  if (balance === 0n || balance < min) {
    const need = min > 0n ? `at least ${formatUnits(min, settings.payoutTokenDecimals)} ${settings.payoutTokenSymbol}` : settings.payoutTokenSymbol;
    throw new HttpError(
      403,
      `To join Stepit your wallet needs ${need} on Robinhood Chain. Add some to this wallet and connect again.`,
      "token_required",
    );
  }
}
