"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Send, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Skeleton";
import { AddressAvatar } from "@/components/wallet/ConnectWallet";
import { api } from "@/lib/fetcher";
import { fmtAmount, fmtDateTime, fmtSteps } from "@/lib/format";
import { fmtPayoutAmount, type Payout } from "./hooks";
import { PageHeader } from "./PageHeader";
import { BatchPayoutModal, type BatchItem } from "./BatchPayoutModal";
import { PayoutModal } from "./PayoutModal";
import { usePreparePayout } from "./usePreparePayout";

interface Ready {
  userId: string;
  userShortId: number;
  walletAddress: `0x${string}`;
  amount: string;
  steps: number;
  days: number;
  lastVerifiedAt: string | null;
}

/** Payout requests from walkers, with their full wallet address — visible only in the admin console. */
export function RequestsView() {
  const [open, setOpen] = useState<Payout | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payouts", "requested"],
    queryFn: () => api<{ payouts: Payout[] }>("/api/admin/payouts?status=requested"),
    refetchInterval: 20_000,
  });
  const prepare = usePreparePayout(setOpen);
  const ready = useQuery({
    queryKey: ["admin", "payouts", "ready"],
    queryFn: () => api<{ ready: Ready[] }>("/api/admin/payouts/ready"),
    refetchInterval: 20_000,
  });
  const readyRows = ready.data?.ready ?? [];
  const [batchOpen, setBatchOpen] = useState(false);
  const rows = (data?.payouts ?? []).slice().sort((a, b) => (a.requestedAt ?? a.createdAt).localeCompare(b.requestedAt ?? b.createdAt));

  return (
    <div>
      <PageHeader
        label="Requests"
        title="Payouts to send"
        description="Walkers who asked to be paid, and walkers with verified days you can pay right away. Full wallet addresses are only shown here, to administrators."
      />
      {(rows.length + readyRows.length > 1) && (
        <div className="mb-5 flex flex-col items-start justify-between gap-3 rounded-3xl border border-lime-400/30 bg-lime-400/[0.06] p-5 sm:flex-row sm:items-center">
          <div>
            <div className="font-display text-lg font-bold">
              {rows.length + readyRows.length} walkers to pay ·{" "}
              <span className="text-lime-300">
                {fmtAmount([...rows.map((p) => Number(p.amount)), ...readyRows.map((r) => Number(r.amount))].reduce((a, b) => a + b, 0))}
              </span>
            </div>
            <div className="text-[13px] text-white/55">Send them all in one go: you approve each transfer in your wallet, back to back.</div>
          </div>
          <Button onClick={() => setBatchOpen(true)} icon={<Send className="h-4 w-4" />}>
            Pay all
          </Button>
        </div>
      )}
      {isLoading && <Skeleton className="h-32" />}
      {!isLoading && rows.length === 0 && (
        <Card className="p-6">
          <EmptyState title="No pending requests">When a walker presses Request payout in their dashboard, it appears here. Verified walkers you can pay now are listed below.</EmptyState>
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
                    {fmtPayoutAmount(p)} <span className="text-sm text-white/50">{p.tokenSymbol}</span>
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

      <PrizeCard />

      <div className="mt-10 mb-4">
        <div className="label">Verified, not paid yet</div>
        <p className="mt-1 text-[13px] text-white/50">Walkers whose screenshots you verified. Pay them now, no request needed.</p>
      </div>
      {ready.isLoading && <Skeleton className="h-24" />}
      {!ready.isLoading && readyRows.length === 0 && (
        <Card className="p-6">
          <EmptyState title="Everyone is paid">When you verify a screenshot, the walker shows up here until you pay them.</EmptyState>
        </Card>
      )}
      <div className="space-y-3">
        {readyRows.map((r) => (
          <Card key={r.userId} className="p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status="approved" />
                  <span className="text-[12px] text-white/45">
                    user #{r.userShortId} · {r.days} verified {r.days === 1 ? "day" : "days"}
                    {r.lastVerifiedAt ? ` · last ${fmtDateTime(r.lastVerifiedAt)}` : ""}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <AddressAvatar address={r.walletAddress} className="h-9 w-9" />
                  <div className="min-w-0">
                    <div className="label !text-[9.5px]">Wallet to pay</div>
                    <div className="break-all font-mono text-[13.5px] text-white">{r.walletAddress}</div>
                  </div>
                  <button
                    className="shrink-0 rounded-lg border border-white/10 p-2 text-white/60 transition hover:border-lime-400/40 hover:text-lime-300"
                    aria-label="Copy wallet"
                    onClick={() => {
                      void navigator.clipboard.writeText(r.walletAddress);
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
                  <div className="mt-1 font-mono text-lg tabular">{fmtSteps(r.steps)}</div>
                </div>
                <div>
                  <div className="label !text-[9.5px]">To send</div>
                  <div className="mt-1 font-display text-2xl font-bold text-lime-300 tabular">{fmtAmount(r.amount)}</div>
                </div>
                <Button onClick={() => prepare.mutate(r.userId)} disabled={prepare.isPending} icon={<Send className="h-4 w-4" />}>
                  Pay
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <PayoutModal payout={open} onClose={() => setOpen(null)} />
      <BatchPayoutModal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        items={[
          ...rows.map<BatchItem>((p) => ({ key: p.id, userShortId: p.userShortId, walletAddress: p.walletAddress, amount: p.amount, payout: p })),
          ...readyRows.map<BatchItem>((r) => ({ key: r.userId, userShortId: r.userShortId, walletAddress: r.walletAddress, amount: r.amount, userId: r.userId })),
        ]}
      />
    </div>
  );
}

interface PrizeStatus {
  weekStart: string;
  weekEnd: string;
  prize: number;
  winner: { userId: string; userShortId: number; walletAddress: string; steps: number } | null;
  awarded: boolean;
}

const fmtWeekDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Last week's #1 walker: award the weekly prize, then pay it from the list below like any other reward. */
function PrizeCard() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "prize"], queryFn: () => api<PrizeStatus>("/api/admin/prize") });
  const award = useMutation({
    mutationFn: () => api<PrizeStatus>("/api/admin/prize", { method: "POST" }),
    onSuccess: async () => {
      toast.success("Weekly prize credited", { description: "It's in the list below, ready to pay." });
      await qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!data || data.prize <= 0) return null;
  return (
    <Card className="mt-10 border-lime-400/30 p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-lime-400 text-ink-950">
            <Trophy className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className="label !text-[9.5px]">
              Weekly prize · {fmtWeekDay(data.weekStart)} to {fmtWeekDay(data.weekEnd)}
            </div>
            {data.winner ? (
              <>
                <div className="mt-1 font-display text-lg font-bold">
                  Walker #{data.winner.userShortId} · {fmtSteps(data.winner.steps)} steps
                </div>
                <div className="break-all font-mono text-[12.5px] text-white/60">{data.winner.walletAddress}</div>
              </>
            ) : (
              <div className="mt-1 text-[14px] text-white/55">No verified steps last week, so no winner.</div>
            )}
          </div>
        </div>
        {data.winner &&
          (data.awarded ? (
            <span className="rounded-full border border-lime-400/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-lime-300">Awarded</span>
          ) : (
            <Button onClick={() => award.mutate()} disabled={award.isPending} icon={<Trophy className="h-4 w-4" />}>
              Award ${data.prize % 1 ? data.prize.toFixed(2) : data.prize}
            </Button>
          ))}
      </div>
    </Card>
  );
}
