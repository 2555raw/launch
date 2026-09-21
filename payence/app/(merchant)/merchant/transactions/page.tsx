import type { Metadata } from "next";
import { requireMerchant } from "@/lib/auth/guard";
import { listTransactions } from "@/lib/services/ledger";
import { PageHeader } from "@/components/app/PageHeader";
import { AssetAmount, FiatAmount } from "@/components/ui/Amount";
import { TxStatusBadge } from "@/components/ui/Status";
import { EmptyState } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icons";
import { RefundDialog } from "./RefundDialog";
import { fromDb, formatUnits } from "@/lib/money";
import { asset, isAssetId, type AssetId } from "@/lib/assets";
import { token } from "@/lib/ids";

export const metadata: Metadata = { title: "Payments · Payence" };

export default function MerchantTransactionsPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const { merchant } = requireMerchant();
  const owner = { type: "merchant" as const, id: merchant.id };
  const transactions = listTransactions(owner, {
    q: searchParams.q?.trim() || undefined,
    status: searchParams.status as "completed" | undefined,
    limit: 200,
  });

  return (
    <div>
      <PageHeader title="Payments" subtitle="Everything in and out of the merchant balance." />
      <div className="space-y-4 px-5 md:px-1">
        <form method="get" className="card flex items-center gap-2 px-4 py-3.5">
          <div className="relative flex-1">
            <Icon.search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              type="search"
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder="Search reference or transaction id"
              aria-label="Search payments"
              className="h-11 w-full rounded-xl border border-hair bg-canvas pl-9 pr-3 text-[14px] outline-none focus:border-ink"
            />
          </div>
          <button type="submit" className="h-11 rounded-xl bg-ink px-4 text-[13px] font-medium text-canvas">
            Search
          </button>
        </form>

        <section className="card overflow-hidden">
          {transactions.length ? (
            <ul className="divide-y divide-hair">
              {transactions.map((tx) => {
                const assetId = isAssetId(tx.asset) ? (tx.asset as AssetId) : "USDC";
                const isRefund = tx.type === "refund";
                const net = fromDb(tx.amount) - (isRefund ? 0n : fromDb(tx.fee));
                const refundable =
                  tx.type === "payment" && tx.status === "completed" ? formatUnits(fromDb(tx.amount), asset(assetId).decimals) : null;
                return (
                  <li key={tx.id} className="px-5 py-4">
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-medium">
                          {isRefund ? "Refund issued" : tx.reference || "Payment"}
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-muted">
                          {new Date(tx.createdAt).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="mt-1 truncate font-mono text-[11.5px] text-faint">{tx.id}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-[14.5px] font-semibold ${isRefund ? "" : "text-positive"}`}>
                          <AssetAmount value={net} assetId={assetId} sign={isRefund ? "out" : "in"} />
                        </p>
                        {!isRefund && fromDb(tx.fee) > 0n && (
                          <p className="text-[12px] text-muted">
                            fee <AssetAmount value={fromDb(tx.fee)} assetId={assetId} showSymbol={false} />
                          </p>
                        )}
                        {tx.fiatAmount && tx.fiatCurrency && (
                          <p className="text-[12px] text-muted">
                            <FiatAmount cents={fromDb(tx.fiatAmount)} currency={tx.fiatCurrency} approx />
                          </p>
                        )}
                        <div className="mt-1.5 flex justify-end">
                          <TxStatusBadge status={tx.status} />
                        </div>
                      </div>
                    </div>
                    {refundable && (
                      <div className="mt-3">
                        <RefundDialog
                          transactionId={tx.id}
                          assetId={assetId}
                          maxAmount={refundable}
                          idempotencyKey={token(16)}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<Icon.list className="h-5 w-5" />}
              title="No payments yet"
              body="Once a customer pays a charge, it appears here with its fee, its fiat value and a refund control."
              action={{ label: "Create a charge", href: "/merchant/payments" }}
            />
          )}
        </section>
      </div>
    </div>
  );
}
