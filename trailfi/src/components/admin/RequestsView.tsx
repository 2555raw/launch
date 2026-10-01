"use client";

import { useQuery } from "@tanstack/react-query";
import { Copy, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Skeleton";
import { AddressAvatar } from "@/components/wallet/ConnectWallet";
import { api } from "@/lib/fetcher";
import { fmtAmount, fmtDateTime, fmtSteps } from "@/lib/format";
import type { Payout } from "./hooks";
import { PageHeader } from "./PageHeader";
import { PayoutModal } from "./PayoutModal";

/** Payout requests from walkers, with their full wallet address — visible only in the admin console. */
export function RequestsView() {
  const [open, setOpen] = useState<Payout | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payouts", "requested"],
    queryFn: () => api<{ payouts: Payout[] }>("/api/admin/payouts?status=requested"),
    refetchInterval: 20_000,
  });
  const rows = (data?.payouts ?? []).slice().sort((a, b) => (a.requestedAt ?? a.createdAt).localeCompare(b.requestedAt ?? b.createdAt));

  return (
    <div>
      <PageHeader
        label="Requests"
        title="Payout requests"
        description="Walkers who asked to be paid. Full wallet addresses are only shown here, to administrators."
      />
      {isLoading && <Skeleton className="h-32" />}
      {!isLoading && rows.length === 0 && (
        <Card className="p-6">
          <EmptyState title="No pending requests">When a walker presses Request payout in their dashboard, it appears here.</EmptyState>
        </Card>
      )}
      <div className="space-y-3">
        {rows.map((p) => (
          <Card key={p.id} className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status="requested" />
                  <span className="text-[12px] text-white/45">{fmtDateTime(p.requestedAt ?? p.createdAt)} · user #{p.userShortId}</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <AddressAvatar address={p.walletAddress} className="h-9 w-9" />
                  <div className="min-w-0">
                    <div className="label !text-[9.5px]">Wallet to pay</div>
                    <div className="break-all font-mono text-[13.5px] text-white">{p.walletAddress}</div>
                  </div>
                  <button
                    className="shrink-0 rounded-lg border border-white/10 p-2 text-white/60 transition hover:border-lime-400/40 hover:text-lime-300"
                    aria-label="Copy wallet"
                    onClick={() => {
                      void navigator.clipboard.writeText(p.walletAddress);
                      toast.success("Wallet copied");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <div className="label !text-[9.5px]">Steps</div>
                  <div className="mt-1 font-mono text-lg tabular">{fmtSteps(p.steps)}</div>
                </div>
                <div>
                  <div className="label !text-[9.5px]">To send</div>
                  <div className="mt-1 font-display text-2xl font-bold text-lime-300 tabular">
                    {fmtAmount(p.amount)} <span className="text-sm text-white/50">{p.tokenSymbol}</span>
                  </div>
                </div>
                <Button onClick={() => setOpen(p)} icon={<Send className="h-4 w-4" />}>
                  Pay
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <PayoutModal payout={open} onClose={() => setOpen(null)} />
    </div>
  );
}
