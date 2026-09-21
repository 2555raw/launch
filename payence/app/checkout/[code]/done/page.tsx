import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/guard";
import { getPaymentRequest, merchantOf } from "@/lib/services/merchants";
import { getTransaction } from "@/lib/services/ledger";
import { CheckoutFrame } from "../Frame";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";
import { AssetAmount } from "@/components/ui/Amount";
import { fromDb } from "@/lib/money";
import type { AssetId } from "@/lib/assets";

export const metadata: Metadata = { title: "Payment complete · Payence" };

/** The last screen of the checkout: confirmation, receipt, and the way back. */
export default function CheckoutDonePage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { tx?: string };
}) {
  const { user } = requireAuth();
  const pr = getPaymentRequest(params.code);
  if (!pr) notFound();
  const merchant = merchantOf(pr.merchantId);
  const tx = searchParams.tx ? getTransaction(searchParams.tx) : undefined;
  if (!tx || tx.fromId !== user.id) notFound();

  return (
    <CheckoutFrame merchant={merchant?.name ?? "Merchant"} website={merchant?.websiteUrl}>
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-positive-soft text-positive">
          <Icon.check className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-[22px] font-bold tracking-tight">Payment complete</h1>
        <p className="mt-2 text-[14px] text-muted">
          {pr.description ? `${pr.description} · ` : ""}Paid to {merchant?.name}
        </p>
        <p className="mt-5 text-[30px] font-extrabold tracking-[-0.03em]">
          <AssetAmount value={fromDb(tx.amount)} assetId={tx.asset as AssetId} />
        </p>
        <p className="mt-6 w-full truncate rounded-xl bg-shell px-4 py-3 font-mono text-[12px] text-muted">{tx.id}</p>

        <div className="mt-7 w-full space-y-3">
          {pr.successUrl ? (
            <Button href={pr.successUrl} size="lg" full>
              Return to {merchant?.name}
            </Button>
          ) : (
            <Button href={`/transactions/${tx.id}`} size="lg" full>
              See the receipt
            </Button>
          )}
          <Button href="/dashboard" variant="secondary" size="lg" full>
            Back to wallet
          </Button>
        </div>
      </div>
    </CheckoutFrame>
  );
}
