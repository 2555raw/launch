import { isAddress } from "viem";
import { HttpError, json, rateLimit, route } from "@/lib/api";
import { checkPayoutToken } from "@/lib/services/gate";

export const dynamic = "force-dynamic";

/** Public: does this address hold enough USDG on Robinhood Chain to join? Balances are public on chain anyway. */
export const GET = route(async (req) => {
  const address = new URL(req.url).searchParams.get("address") ?? "";
  if (!isAddress(address)) throw new HttpError(400, "Enter a valid wallet address (0x…).", "bad_address");
  rateLimit(`token-check:${address.toLowerCase()}`, 12, 60_000);
  return json(await checkPayoutToken(address));
});
