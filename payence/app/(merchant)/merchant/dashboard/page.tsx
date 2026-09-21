import Link from "next/link";
import type { Metadata } from "next";
import { requireMerchant } from "@/lib/auth/guard";
import { merchantStats, listPaymentRequests, effectiveStatus, acceptedAssets } from "@/lib/services/merchants";
import { listTransactions, getBalances } from "@/lib/services/ledger";
import { portfolio } from "@/lib/services/portfolio";
import { PageHeader } from "@/components/app/PageHeader";
import { AssetAmount, FiatAmount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Status";
import { EmptyState } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";
import { asset, type AssetId } from "@/lib/assets";
import { fromDb } from "@/lib/money";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Merchant · Payence" };

const WINDOWS = { "7": 7, "30": 30, "90": 90 } as const;

export default async function MerchantDashboard({ searchParams }: { searchParams: { days?: string } }) {
  const { merchant } = requireMerchant();
  const days = WINDOWS[(searchParams.days as keyof typeof WINDOWS) ?? "30"] ?? 30;
  const since = Date.now() - days * 24 * 60 * 60_000;

  const stats = merchantStats(merchant.id, since);
  const owner = { type: "merchant" as const, id: merchant.id };
  const folio = await portfolio(owner, merchant.pricingCurrency as "EUR" | "USD");
  const recent = listTransactions(owner, { limit: 6 });
  const open = listPaymentRequests(merchant.id, 50).filter((p) => effectiveStatus(p) === "open");
  const balances = getBalances(owner).filter((b) => b.available > 0n);

  return (
    <div>
      <PageHeader
        title={merchant.name}
        subtitle={`Accepting ${acceptedAssets(merchant).join(", ")} · settling into ${merchant.settlementAsset}`}
        action={
          <Button href="/merchant/payments" size="md">
            New charge
          </Button>
        }
      />

      <div className="space-y-5 px-5 md:px-1">
        {merchant.status !== "verified" && (
          <Alert tone="warning" title="Verification pending.">
            You can take payments, but settlement to an external account stays locked until business verification is
            complete. That check runs through a regulated KYB provider, which is not connected here.
          </Alert>
        )}

        <nav aria-label="Period" className="flex gap-2">
          {Object.keys(WINDOWS).map((d) => (
            <Link
              key={d}
              href={`/merchant/dashboard?days=${d}`}
              aria-current={String(days) === d ? "page" : undefined}
              className={`rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                String(days) === d ? "border-ink bg-ink text-canvas" : "border-hair hover:border-hairStrong"
              }`}
            >
              {d} days
            </Link>
          ))}
        </nav>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Balance" value={<FiatAmount cents={folio.availableFiat} currency={folio.currency} />} note={`${balances.length} asset${balances.length === 1 ? "" : "s"}`} />
          <Stat label={`Payments · ${days}d`} value={String(stats.completed)} note={`${stats.refundCount} refunded`} />
          <Stat
            label={`Fees · ${days}d`}
            value={<AssetAmount value={stats.fees} assetId={merchant.settlementAsset as AssetId} showSymbol={false} />}
            note="0.6% per payment"
          />
        </div>

        <section className="card overflow-hidden">
          <h2 className="border-b border-hair px-5 py-4 text-[15px] font-semibold">Net revenue by asset</h2>
          {stats.netByAsset.size ? (
            <ul className="divide-y divide-hair">
              {[...stats.netByAsset.entries()].map(([a, amount]) => (
                <li key={a} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-[14px]">{asset(a).name}</span>
                  <span className="text-[14.5px] font-semibold">
                    <AssetAmount value={amount} assetId={a} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Icon.chart className="h-5 w-5" />}
              title="No revenue in this period"
              body="Create a charge and show the QR to a customer, or send them the payment link."
              action={{ label: "New charge", href: "/merchant/payments" }}
            />
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-hair px-5 py-4">
            <h2 className="text-[15px] font-semibold">Waiting to be paid</h2>
            <span className="text-[13px] text-muted">{open.length} open</span>
          </div>
          {open.length ? (
            <ul className="divide-y divide-hair">
              {open.slice(0, 5).map((pr) => (
                <li key={pr.id}>
                  <Link href={`/merchant/payments/${pr.code}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-shell/60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{pr.description || "Charge"}</span>
                      <span className="block font-mono text-[12px] text-muted">{pr.code}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[14px] font-semibold">
                        {formatPrice(pr.priceCurrency, pr.priceAmount)}
                      </span>
                      <Badge tone="warning">Open</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-[13.5px] text-muted">Nothing outstanding.</p>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-hair px-5 py-4">
            <h2 className="text-[15px] font-semibold">Recent payments</h2>
            <Link href="/merchant/transactions" className="text-[13px] text-muted hover:text-ink">
              See all
            </Link>
          </div>
          {recent.length ? (
            <ul className="divide-y divide-hair">
              {recent.map((tx) => (
                <li key={tx.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">
                      {tx.type === "refund" ? "Refund" : tx.reference || "Payment"}
                    </span>
                    <span className="block text-[12.5px] text-muted">
                      {new Date(tx.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[14.5px] font-semibold">
                    <AssetAmount
                      value={fromDb(tx.amount) - (tx.type === "refund" ? 0n : fromDb(tx.fee))}
                      assetId={tx.asset as AssetId}
                      sign={tx.type === "refund" ? "out" : "in"}
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-[13.5px] text-muted">No payments yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-[12px] uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 text-[24px] font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-[12.5px] text-muted">{note}</p>
    </div>
  );
}

export function formatPrice(currency: string, amount: string): string {
  if (currency === "EUR" || currency === "USD") {
    const n = Number(amount) / 100;
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(n);
  }
  const a = asset(currency as AssetId);
  return `${(Number(amount) / 10 ** a.decimals).toFixed(2)} ${a.symbol}`;
}
