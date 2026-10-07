import { json, rateLimit, route } from "@/lib/api";
import { requireUser } from "@/lib/auth/guard";
import { requestPayout } from "@/lib/services/payouts";

export const dynamic = "force-dynamic";

/** A walker asks to be paid their approved rewards. Nothing is sent until the owner pays it. */
export const POST = route(async () => {
  const me = await requireUser();
  rateLimit(`payout-request:${me.id}`, 5, 60_000);
  const payout = await requestPayout(me.id, me.wallet_address);
  // amount is in the payout token (ETH for native payouts, quoted again when it is sent); usdAmount is the dollars owed.
  return json(
    {
      payout: {
        id: payout.id,
        amount: payout.amount,
        usdAmount: payout.usdAmount,
        ethUsdPrice: payout.ethUsdPrice,
        tokenSymbol: payout.tokenSymbol,
        steps: payout.steps,
        status: payout.status,
      },
    },
    201,
  );
});
