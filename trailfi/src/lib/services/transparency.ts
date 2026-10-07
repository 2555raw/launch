import "server-only";
import { one } from "@/lib/db";
import { env } from "@/lib/env";
import { explorerAddressUrl, PAYOUT_CHAIN_ID } from "@/lib/web3/chains";
import { publicPayouts } from "./payouts";

/**
 * Everything the public transparency page shows: what has been paid, to how many
 * walkers, for how many verified steps, and every payout with its transaction.
 * Demo (simulated) payouts are left out of the totals.
 */
export async function transparencyReport() {
  const [totals, steps, walkers, payouts] = await Promise.all([
    one<{ usd: number; eth: number; count: number; paidWalkers: number }>(
      `select coalesce(sum(coalesce(usd_amount, amount)), 0)::float8 as usd,
              coalesce(sum(amount) filter (where token_symbol = 'ETH'), 0)::float8 as eth,
              count(*)::int as count, count(distinct user_id)::int as "paidWalkers"
         from payouts where status = 'confirmed' and not simulated`,
    ),
    one<{ n: number }>(
      `select coalesce(sum(valid_steps), 0)::float8 as n from rewards where kind = 'steps' and status in ('approved', 'paid')`,
    ),
    one<{ n: number }>("select count(*)::int as n from users where status = 'active' and role <> 'admin'"),
    publicPayouts(100),
  ]);
  return {
    paidUsd: totals?.usd ?? 0,
    paidEth: totals?.eth ?? 0,
    payoutCount: totals?.count ?? 0,
    paidWalkers: totals?.paidWalkers ?? 0,
    verifiedSteps: Number(steps?.n ?? 0),
    walkers: walkers?.n ?? 0,
    // The wallets payouts are sent from: their full history is public on the explorer.
    rewardWallets: env.payoutWallets.map((w) => ({ address: w, url: explorerAddressUrl(PAYOUT_CHAIN_ID, w) })),
    payouts,
  };
}
