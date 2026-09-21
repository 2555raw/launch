import Link from "next/link";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { portfolio } from "@/lib/services/portfolio";
import { listTransactions } from "@/lib/services/ledger";
import { limitUsage } from "@/lib/services/limits";
import { BalanceCard } from "@/components/app/BalanceCard";
import { QuickActions } from "@/components/app/QuickActions";
import { TransactionList } from "@/components/app/TransactionList";
import { Icon } from "@/components/ui/Icons";
import { EmptyState } from "@/components/ui/States";
import { FiatAmount } from "@/components/ui/Amount";

export const metadata: Metadata = { title: "Home · Payence" };

export default async function DashboardPage() {
  const { user } = requireAuth();
  const owner = { type: "user" as const, id: user.id };
  const folio = await portfolio(owner, user.displayCurrency as "EUR" | "USD");
  const recent = listTransactions(owner, { limit: 6 });
  const usage = limitUsage(user);

  return (
    <div className="space-y-6 px-5 pb-6 pt-6 md:px-1 md:pt-0">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-[22px] font-bold tracking-[-0.03em]">
          Hello, {user.name.split(" ")[0]}
        </h1>
        <Link href="/notifications" className="text-[13px] text-muted hover:text-ink">
          Notifications
        </Link>
      </div>

      <BalanceCard portfolio={folio} />
      <QuickActions />

      {user.kycTier === 0 && (
        <Link
          href="/settings/verification"
          className="flex items-center gap-4 rounded-card border border-hair bg-surface px-5 py-4 shadow-card transition-colors hover:border-hairStrong"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-coral-soft text-coral">
            <Icon.shield className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-semibold">Verify your identity</span>
            <span className="block text-[13px] text-muted">
              Raise your limit from <FiatAmount cents={usage.tier.daily} currency={folio.currency} /> a day.
            </span>
          </span>
          <Icon.chevron className="h-4 w-4 shrink-0 text-muted" />
        </Link>
      )}

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-hair px-5 py-4">
          <h2 className="text-[15px] font-semibold">Recent activity</h2>
          <Link href="/transactions" className="text-[13px] text-muted hover:text-ink">
            See all
          </Link>
        </div>
        {recent.length ? (
          <TransactionList transactions={recent} owner={owner} />
        ) : (
          <EmptyState
            icon={<Icon.list className="h-5 w-5" />}
            title="No activity yet"
            body="Your payments, transfers and deposits will appear here as soon as you make one."
            action={{ label: "Add money", href: "/wallet/deposit" }}
          />
        )}
      </section>
    </div>
  );
}
