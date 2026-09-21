import Link from "next/link";
import type { schema } from "@/lib/db";
import { directionFor, type Owner } from "@/lib/services/ledger";
import { AssetAmount, FiatAmount } from "@/components/ui/Amount";
import { TX_STATUS } from "@/components/ui/Status";
import { Icon, type IconName } from "@/components/ui/Icons";
import type { AssetId } from "@/lib/assets";

type Tx = typeof schema.transactions.$inferSelect;

const TYPE_ICON: Record<string, IconName> = {
  deposit: "plus",
  withdrawal: "minus",
  transfer: "send",
  payment: "store",
  refund: "refresh",
  conversion: "swap",
};

export function rowLabel(tx: Tx, direction: "in" | "out" | "internal"): string {
  if (tx.type === "conversion") return tx.counterparty ?? "Conversion";
  if (tx.type === "deposit") return tx.counterparty ?? "Deposit";
  if (tx.type === "withdrawal") return `To ${tx.counterparty ?? "external wallet"}`;
  if (tx.type === "refund") return `Refund from ${tx.counterparty ?? "merchant"}`;
  if (!tx.counterparty) return direction === "in" ? "Received" : "Sent";
  return direction === "in" ? `From ${tx.counterparty}` : `To ${tx.counterparty}`;
}

/** One list, used on the dashboard and on the activity page. */
export function TransactionList({ transactions, owner }: { transactions: Tx[]; owner: Owner }) {
  return (
    <ul className="divide-y divide-hair">
      {transactions.map((tx) => {
        const direction = directionFor(tx, owner);
        const I = Icon[TYPE_ICON[tx.type] ?? "list"];
        const status = TX_STATUS[tx.status] ?? TX_STATUS.pending;
        const incoming = direction === "in";
        const settled = tx.status === "completed";
        return (
          <li key={tx.id}>
            <Link href={`/transactions/${tx.id}`} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-shell/60">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  incoming ? "bg-positive-soft text-positive" : "bg-shell text-ink"
                }`}
              >
                <I className="h-[18px] w-[18px]" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium">{rowLabel(tx, direction)}</span>
                <span className="block truncate text-[12.5px] text-muted">
                  {new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  {" · "}
                  {new Date(tx.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  {!settled && ` · ${status.label}`}
                </span>
              </span>

              <span className="shrink-0 text-right">
                <span className={`block text-[14.5px] font-semibold ${incoming && settled ? "text-positive" : ""}`}>
                  <AssetAmount
                    value={BigInt(tx.amount)}
                    assetId={tx.asset as AssetId}
                    sign={direction === "internal" ? undefined : incoming ? "in" : "out"}
                  />
                </span>
                {tx.fiatAmount && tx.fiatCurrency && (
                  <span className="block text-[12px] text-muted">
                    <FiatAmount cents={BigInt(tx.fiatAmount)} currency={tx.fiatCurrency} approx />
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
