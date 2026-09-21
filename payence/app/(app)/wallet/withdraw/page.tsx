import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { getBalances } from "@/lib/services/ledger";
import { PageHeader } from "@/components/app/PageHeader";
import { WithdrawForm } from "./WithdrawForm";
import { ASSET_IDS } from "@/lib/assets";
import { NETWORKS, NETWORK_IDS } from "@/lib/networks";
import { token } from "@/lib/ids";

export const metadata: Metadata = { title: "Withdraw · Payence" };

export default function WithdrawPage() {
  const { user } = requireAuth();
  const balances = Object.fromEntries(
    getBalances({ type: "user", id: user.id }).map((b) => [b.asset, b.available.toString()])
  );
  const networks = NETWORK_IDS.map((idv) => ({
    id: idv,
    name: NETWORKS[idv].name,
    assets: ASSET_IDS.filter((a) => NETWORKS[idv].tokens[a]),
    fee: NETWORKS[idv].withdrawalFeeUnits.toString(),
    seconds: NETWORKS[idv].confirmationSeconds * NETWORKS[idv].confirmations,
  }));

  return (
    <div>
      <PageHeader title="Withdraw" subtitle="Send stablecoins to a wallet you control." back="/wallet" />
      <div className="px-5 md:px-1">
        <WithdrawForm balances={balances} networks={networks} idempotencyKey={token(16)} />
      </div>
    </div>
  );
}
