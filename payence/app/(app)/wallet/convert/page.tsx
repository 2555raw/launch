import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { getBalances } from "@/lib/services/ledger";
import { PageHeader } from "@/components/app/PageHeader";
import { ConvertForm } from "./ConvertForm";
import { fiatRate } from "@/lib/providers/rates";
import { token } from "@/lib/ids";
import { FEES } from "@/lib/services/fees";

export const metadata: Metadata = { title: "Convert · Payence" };

export default async function ConvertPage() {
  const { user } = requireAuth();
  const balances = Object.fromEntries(
    getBalances({ type: "user", id: user.id }).map((b) => [b.asset, b.available.toString()])
  );
  const quote = await fiatRate("USDC", "EUR");

  return (
    <div>
      <PageHeader title="Convert" subtitle="Move between stablecoins at the reference rate." back="/wallet" />
      <div className="px-5 md:px-1">
        <ConvertForm
          balances={balances}
          feeBps={FEES.conversionBps}
          rateSource={quote.source}
          idempotencyKey={token(16)}
        />
      </div>
    </div>
  );
}
