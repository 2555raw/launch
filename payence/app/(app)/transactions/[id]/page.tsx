import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/guard";
import { getTransaction, directionFor } from "@/lib/services/ledger";
import { PageHeader } from "@/components/app/PageHeader";
import { AssetAmount, FiatAmount } from "@/components/ui/Amount";
import { TxStatusBadge, TX_STATUS } from "@/components/ui/Status";
import { Copyable } from "@/components/ui/Copyable";
import { Icon } from "@/components/ui/Icons";
import { asset, type AssetId } from "@/lib/assets";
import { NETWORKS, isNetworkId } from "@/lib/networks";
import { rowLabel } from "@/components/app/TransactionList";
import { fromDb } from "@/lib/money";
import { SIMULATED_CHAIN } from "@/lib/config";

export const metadata: Metadata = { title: "Transaction · Payence" };

/** The receipt. Everything the user (or their accountant) could need, nothing hidden. */
export default function TransactionPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { new?: string };
}) {
  const { user } = requireAuth();
  const owner = { type: "user" as const, id: user.id };
  const tx = getTransaction(params.id);
  // A transaction the user was not part of is not theirs to read.
  if (!tx || ![tx.fromId, tx.toId].includes(user.id)) notFound();

  const direction = directionFor(tx, owner);
  const assetId = tx.asset as AssetId;
  const status = TX_STATUS[tx.status] ?? TX_STATUS.pending;
  const net = tx.network && isNetworkId(tx.network) ? NETWORKS[tx.network] : null;
  const meta = tx.metadata ? (JSON.parse(tx.metadata) as Record<string, string>) : {};
  const total = fromDb(tx.amount) + (direction === "out" ? fromDb(tx.fee) : 0n);

  return (
    <div>
      <PageHeader title="Transaction" back="/transactions" />
      <div className="space-y-5 px-5 md:px-1">
        {searchParams.new === "1" && tx.status === "completed" && (
          <div className="flex items-center gap-3 rounded-card border border-positive/25 bg-positive-soft px-5 py-4 text-positive">
            <Icon.check className="h-5 w-5 shrink-0" />
            <p className="text-[14px] font-medium">Done. Your payment went through.</p>
          </div>
        )}

        <section className="card px-6 py-7 text-center">
          <p className="text-[13.5px] text-muted">{rowLabel(tx, direction)}</p>
          <p className="mt-2 text-amount font-extrabold">
            <AssetAmount
              value={fromDb(tx.amount)}
              assetId={assetId}
              sign={direction === "internal" ? undefined : direction === "in" ? "in" : "out"}
            />
          </p>
          {tx.fiatAmount && tx.fiatCurrency && (
            <p className="mt-1.5 text-[14px] text-muted">
              <FiatAmount cents={fromDb(tx.fiatAmount)} currency={tx.fiatCurrency} approx /> at the time
            </p>
          )}
          <div className="mt-5 flex justify-center">
            <TxStatusBadge status={tx.status} />
          </div>
          <p className="mx-auto mt-3 max-w-[40ch] text-[13px] leading-relaxed text-muted">{status.help}</p>
          {tx.failureReason && <p className="mt-3 text-[13px] text-danger">{tx.failureReason}</p>}
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-hair px-5 py-3.5 text-[14px] font-semibold">Details</h2>
          <dl className="divide-y divide-hair text-[13.5px]">
            <Row label="Type" value={tx.type[0].toUpperCase() + tx.type.slice(1)} />
            {tx.counterparty && <Row label={direction === "in" ? "From" : "To"} value={tx.counterparty} />}
            <Row
              label="Amount"
              value={<AssetAmount value={fromDb(tx.amount)} assetId={assetId} />}
            />
            <Row
              label="Fee"
              value={
                fromDb(tx.fee) === 0n ? (
                  "Free"
                ) : (
                  <AssetAmount value={fromDb(tx.fee)} assetId={assetId} />
                )
              }
            />
            {direction === "out" && (
              <Row label="Total charged" value={<AssetAmount value={total} assetId={assetId} />} />
            )}
            {tx.type === "conversion" && meta.received && (
              <Row
                label="Received"
                value={<AssetAmount value={BigInt(meta.received)} assetId={meta.toAsset as AssetId} />}
              />
            )}
            {tx.rate && tx.fiatCurrency && (
              <Row label="Rate" value={`1 ${asset(assetId).symbol} = ${tx.rate} ${tx.fiatCurrency}`} />
            )}
            <Row
              label="Date"
              value={new Date(tx.createdAt).toLocaleString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
            {tx.reference && <Row label="Reference" value={tx.reference} />}
          </dl>
        </section>

        {(net || tx.txHash || tx.address) && (
          <section className="card overflow-hidden">
            <h2 className="border-b border-hair px-5 py-3.5 text-[14px] font-semibold">On-chain</h2>
            <dl className="divide-y divide-hair text-[13.5px]">
              {net && <Row label="Network" value={net.name} />}
              {net && (
                <Row
                  label="Confirmation"
                  value={`${net.confirmations} block${net.confirmations === 1 ? "" : "s"} (~${
                    net.confirmationSeconds * net.confirmations
                  }s)`}
                />
              )}
              {tx.address && (
                <Row
                  label="Address"
                  value={
                    <span className="flex items-center gap-2">
                      <span className="truncate font-mono text-[12.5px]">{tx.address}</span>
                      <Copyable value={tx.address} label="" />
                    </span>
                  }
                />
              )}
              {tx.txHash && (
                <Row
                  label="Transaction hash"
                  value={
                    <span className="flex items-center gap-2">
                      <span className="truncate font-mono text-[12.5px]">{tx.txHash}</span>
                      <Copyable value={tx.txHash} label="" />
                    </span>
                  }
                />
              )}
            </dl>
            {tx.txHash && net && (
              <div className="border-t border-hair px-5 py-3.5">
                {SIMULATED_CHAIN ? (
                  <p className="text-[12.5px] leading-relaxed text-muted">
                    This is a demo environment, so the hash is generated locally and no explorer will list it. With a
                    real chain provider configured, this row links to {net.name}&apos;s explorer.
                  </p>
                ) : (
                  <a
                    href={net.explorer.tx(tx.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline underline-offset-4"
                  >
                    View on {net.name} explorer
                    <Icon.external className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            )}
          </section>
        )}

        <section className="card px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[12px] text-muted">Transaction ID</span>
              <span className="block truncate font-mono text-[12.5px]">{tx.id}</span>
            </span>
            <Copyable value={tx.id} label="Copy" />
          </div>
        </section>

        <p className="pb-2 text-center text-[13px]">
          <Link href="/settings/support" className="text-muted underline underline-offset-4 hover:text-ink">
            Something wrong with this payment?
          </Link>
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 px-5 py-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{value}</dd>
    </div>
  );
}
