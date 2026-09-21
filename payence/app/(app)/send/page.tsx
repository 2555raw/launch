import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { getBalances } from "@/lib/services/ledger";
import { limitUsage } from "@/lib/services/limits";
import { PageHeader } from "@/components/app/PageHeader";
import { SendForm } from "./SendForm";
import { ASSET_IDS } from "@/lib/assets";
import { FiatAmount } from "@/components/ui/Amount";
import { token } from "@/lib/ids";

export const metadata: Metadata = { title: "Send · Payence" };

export default function SendPage() {
  const { user } = requireAuth();
  const balances = Object.fromEntries(
    getBalances({ type: "user", id: user.id }).map((b) => [b.asset, b.available.toString()])
  );
  const usage = limitUsage(user);

  return (
    <div>
      <PageHeader title="Send" subtitle="To anyone with a Payence account. Arrives instantly, no fee." back="/dashboard" />
      <div className="space-y-5 px-5 md:px-1">
        <SendForm
          assets={ASSET_IDS}
          balances={balances}
          idempotencyKey={token(16)}
        />
        <p className="text-[12.5px] leading-relaxed text-muted">
          Remaining today: <FiatAmount cents={usage.dailyLimit - usage.dailyUsed} currency={user.displayCurrency} /> of{" "}
          <FiatAmount cents={usage.dailyLimit} currency={user.displayCurrency} /> ({usage.tier.label} level).
        </p>
      </div>
    </div>
  );
}
