import type { Metadata } from "next";
import { requireAuth } from "@/lib/auth/guard";
import { listTransactions, type TxFilter } from "@/lib/services/ledger";
import { PageHeader } from "@/components/app/PageHeader";
import { TransactionList } from "@/components/app/TransactionList";
import { TransactionFilters } from "./Filters";
import { EmptyState } from "@/components/ui/States";
import { Icon } from "@/components/ui/Icons";
import { isAssetId, type AssetId } from "@/lib/assets";

export const metadata: Metadata = { title: "Activity · Payence" };

const STATUSES = ["pending", "processing", "completed", "failed", "cancelled", "expired"];
const TYPES = ["deposit", "withdrawal", "transfer", "payment", "refund", "conversion"];

export default function TransactionsPage({
  searchParams,
}: {
  searchParams: { q?: string; asset?: string; status?: string; type?: string; from?: string; to?: string };
}) {
  const { user } = requireAuth();
  const owner = { type: "user" as const, id: user.id };

  const filter: TxFilter = {
    q: searchParams.q?.trim() || undefined,
    asset: isAssetId(searchParams.asset) ? (searchParams.asset as AssetId) : undefined,
    status: STATUSES.includes(searchParams.status ?? "") ? (searchParams.status as TxFilter["status"]) : undefined,
    type: TYPES.includes(searchParams.type ?? "") ? (searchParams.type as TxFilter["type"]) : undefined,
    from: parseDate(searchParams.from),
    to: parseDate(searchParams.to, true),
    limit: 200,
  };
  const transactions = listTransactions(owner, filter);
  const filtered = Boolean(filter.q || filter.asset || filter.status || filter.type || filter.from || filter.to);

  return (
    <div>
      <PageHeader title="Activity" subtitle="Every payment, transfer, deposit and refund on your account." />
      <div className="space-y-4 px-5 md:px-1">
        <TransactionFilters defaults={searchParams} />
        <section className="card overflow-hidden">
          {transactions.length ? (
            <TransactionList transactions={transactions} owner={owner} />
          ) : filtered ? (
            <EmptyState
              icon={<Icon.search className="h-5 w-5" />}
              title="Nothing matches those filters"
              body="Try a wider date range, or clear the filters to see everything on the account."
              action={{ label: "Clear filters", href: "/transactions" }}
            />
          ) : (
            <EmptyState
              icon={<Icon.list className="h-5 w-5" />}
              title="No transactions yet"
              body="Once you add money or make a payment, the full history lives here with fees, rates and receipts."
              action={{ label: "Add money", href: "/wallet/deposit" }}
            />
          )}
        </section>
        {transactions.length >= 200 && (
          <p className="text-center text-[12.5px] text-muted">Showing the 200 most recent. Narrow the dates to see more.</p>
        )}
      </div>
    </div>
  );
}

function parseDate(value: string | undefined, endOfDay = false): number | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d.getTime();
}
