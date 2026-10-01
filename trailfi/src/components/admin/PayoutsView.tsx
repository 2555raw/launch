"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { DemoBadge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { fmtAmount, fmtDateTime, shortAddress } from "@/lib/format";
import { SUPPORTED_CHAINS, explorerTxUrl } from "@/lib/web3/chains";
import type { Payout } from "./hooks";
import { PageHeader } from "./PageHeader";
import { PayoutModal } from "./PayoutModal";

const TABS = ["all", "prepared", "submitted", "confirmed", "failed", "cancelled"] as const;

export function PayoutsView() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [open, setOpen] = useState<Payout | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payouts", tab],
    queryFn: () => api<{ payouts: Payout[] }>(`/api/admin/payouts?status=${tab}`),
  });

  return (
    <div>
      <PageHeader
        label="Payouts"
        title="Transaction history"
        description="Every payout, from preparation to onchain confirmation. Open one to send it, verify it or cancel it."
        action={
          <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn("shrink-0 rounded-xl px-3 py-1.5 text-[12.5px] font-medium capitalize", tab === t ? "bg-lime-400 text-forest-950" : "text-white/60 hover:text-white")}
              >
                {t}
              </button>
            ))}
          </div>
        }
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="table-head">Created</th>
                <th className="table-head">User</th>
                <th className="table-head">Destination</th>
                <th className="table-head">Amount</th>
                <th className="table-head">Network</th>
                <th className="table-head">Status</th>
                <th className="table-head">Tx hash</th>
                <th className="table-head">Prepared by</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="table-cell">
                    <Skeleton className="h-8" />
                  </td>
                </tr>
              )}
              {data?.payouts.map((p) => {
                const url = p.txHash ? explorerTxUrl(p.chainId, p.txHash) : null;
                return (
                  <tr key={p.id} onClick={() => setOpen(p)} className="cursor-pointer border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]">
                    <td className="table-cell whitespace-nowrap">{fmtDateTime(p.createdAt)}</td>
                    <td className="table-cell text-white/60">#{p.userShortId}</td>
                    <td className="table-cell font-mono text-[13px]">{shortAddress(p.walletAddress, 8, 6)}</td>
                    <td className="table-cell font-mono text-lime-300">
                      {fmtAmount(p.amount)} <span className="text-white/35">{p.tokenSymbol}</span>
                    </td>
                    <td className="table-cell text-[13px]">{SUPPORTED_CHAINS[p.chainId]?.name ?? p.chainId}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={p.status} />
                        {p.simulated && <DemoBadge>sim</DemoBadge>}
                      </div>
                    </td>
                    <td className="table-cell font-mono text-[12.5px]">
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 hover:text-lime-300">
                          {shortAddress(p.txHash, 8, 6)} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-white/30">None</span>
                      )}
                    </td>
                    <td className="table-cell font-mono text-[12px] text-white/45">{shortAddress(p.preparedBy)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && data.payouts.length === 0 && (
          <div className="p-6">
            <EmptyState title="No payouts">Prepare one from a user with approved rewards.</EmptyState>
          </div>
        )}
      </Card>
      <PayoutModal payout={open} onClose={() => setOpen(null)} />
    </div>
  );
}
