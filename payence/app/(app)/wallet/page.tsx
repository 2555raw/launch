import Link from "next/link";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { portfolio } from "@/lib/services/portfolio";
import { PageHeader } from "@/components/app/PageHeader";
import { AssetAmount, AssetMark, FiatAmount } from "@/components/ui/Amount";
import { Icon } from "@/components/ui/Icons";
import { asset } from "@/lib/assets";
import { Badge } from "@/components/ui/Status";

export const metadata: Metadata = { title: "Wallet · Payence" };

const ACTIONS = [
  { href: "/wallet/deposit", label: "Add money", icon: "plus" as const },
  { href: "/wallet/withdraw", label: "Withdraw", icon: "minus" as const },
  { href: "/wallet/convert", label: "Convert", icon: "swap" as const },
];

export default async function WalletPage() {
  const { user } = requireAuth();
  const folio = await portfolio({ type: "user", id: user.id }, user.displayCurrency as "EUR" | "USD");

  return (
    <div>
      <PageHeader title="Wallet" subtitle={`Balances shown in ${folio.currency} at today's rate.`} />

      <div className="space-y-6 px-5 md:px-1">
        <section className="card px-6 py-6">
          <p className="text-[12px] uppercase tracking-[0.1em] text-muted">Total</p>
          <p className="mt-2 text-amount font-extrabold">
            <FiatAmount cents={folio.totalFiat} currency={folio.currency} />
          </p>
          {folio.pendingFiat > 0n && (
            <p className="mt-2 text-[13px] text-muted">
              Includes <FiatAmount cents={folio.pendingFiat} currency={folio.currency} /> still settling.
            </p>
          )}
          <ul className="mt-6 grid grid-cols-3 gap-2.5">
            {ACTIONS.map((a) => {
              const I = Icon[a.icon];
              return (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    className="flex flex-col items-center gap-2 rounded-xl border border-hair px-2 py-3.5 text-[12.5px] font-medium transition-colors hover:border-hairStrong"
                  >
                    <I className="h-[18px] w-[18px]" />
                    {a.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-hair px-5 py-4 text-[15px] font-semibold">Assets</h2>
          <ul className="divide-y divide-hair">
            {folio.holdings.map((h) => {
              const a = asset(h.asset);
              return (
                <li key={h.asset} className="flex items-center gap-3.5 px-5 py-4">
                  <AssetMark assetId={h.asset} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-medium">{a.name}</p>
                    <p className="text-[12.5px] text-muted">
                      {a.symbol} · issued by {a.issuer}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[14.5px] font-semibold">
                      <AssetAmount value={h.available} assetId={h.asset} showSymbol={false} />
                    </p>
                    <p className="text-[12px] text-muted">
                      <FiatAmount cents={h.fiatAvailable} currency={folio.currency} approx />
                    </p>
                    {h.pending > 0n && (
                      <p className="mt-1">
                        <Badge tone="warning">
                          <AssetAmount value={h.pending} assetId={h.asset} showSymbol={false} /> settling
                        </Badge>
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-hair px-5 py-3.5 text-[12px] text-muted">
            Rates from {folio.rateSource}. Stablecoin values track their peg; the fiat figure is an estimate, not a
            guaranteed conversion.
          </p>
        </section>
      </div>
    </div>
  );
}
