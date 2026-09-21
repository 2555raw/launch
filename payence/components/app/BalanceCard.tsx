import Link from "next/link";
import type { Portfolio } from "@/lib/services/portfolio";
import { FiatAmount } from "@/components/ui/Amount";
import { Icon } from "@/components/ui/Icons";

/**
 * The number the app exists to show. Total first, at display size; available
 * and pending underneath, because a user who cannot tell them apart will think
 * money is missing.
 */
export function BalanceCard({ portfolio }: { portfolio: Portfolio }) {
  return (
    <section className="rounded-card bg-ink px-6 py-7 text-canvas shadow-card">
      <p className="text-[12px] uppercase tracking-[0.1em] text-canvas/50">Total balance</p>
      <p className="mt-2 text-amount font-extrabold">
        <FiatAmount cents={portfolio.totalFiat} currency={portfolio.currency} />
      </p>

      <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 border-t border-hairDark pt-5 text-[13px]">
        <div>
          <dt className="text-canvas/50">Available</dt>
          <dd className="mt-1 font-semibold">
            <FiatAmount cents={portfolio.availableFiat} currency={portfolio.currency} />
          </dd>
        </div>
        <div>
          <dt className="text-canvas/50">Pending</dt>
          <dd className="mt-1 font-semibold">
            <FiatAmount cents={portfolio.pendingFiat} currency={portfolio.currency} />
          </dd>
        </div>
        <div className="ml-auto self-end">
          <Link href="/wallet" className="inline-flex items-center gap-1.5 text-[13px] text-canvas/70 hover:text-canvas">
            Wallet
            <Icon.chevron className="h-3.5 w-3.5" />
          </Link>
        </div>
      </dl>
    </section>
  );
}
