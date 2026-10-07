"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, CheckCircle2, Copy, ExternalLink, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { StatCard } from "@/components/dashboard/StatCard";
import { DemoBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Skeleton";
import { AddressAvatar } from "@/components/wallet/ConnectWallet";
import { api } from "@/lib/fetcher";
import { fmtAmount, fmtDate, fmtDateTime, fmtSteps, shortAddress } from "@/lib/format";
import { PAYOUT_CHAIN_ID, explorerAddressUrl, explorerTxUrl } from "@/lib/web3/chains";
import { CircleDollarSign, Coins, Hourglass, BadgeCheck } from "lucide-react";
import { fmtPayoutAmount, type Payout } from "./hooks";
import { PayoutModal } from "./PayoutModal";
import { usePreparePayout } from "./usePreparePayout";

interface Profile {
  user: {
    id: string;
    shortId: number;
    walletAddress: string;
    role: string;
    status: "active" | "suspended";
    payoutConsentAt: string | null;
    createdAt: string;
    lastLoginAt: string | null;
  };
  steps: Array<{ id: string; day: string; steps: number; source: string; verification: string; flags: string[]; reviewedBy: string | null; reviewNote: string | null }>;
  rewards: Array<{ id: string; periodStart: string; periodEnd: string; amount: number; status: string; validSteps: number; tokenSymbol: string; rejectionReason: string | null }>;
  summary: { pending: number; approved: number; processing: number; paid: number; total: number };
  payouts: Payout[];
}

export function UserProfileView({ id }: { id: string }) {
  const qc = useQueryClient();
  const [payout, setPayout] = useState<Payout | null>(null);
  const prepare = usePreparePayout(setPayout);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "user", id],
    queryFn: () => api<Profile>(`/api/admin/users/${id}`),
  });

  const review = useMutation({
    mutationFn: (v: { entryId: string; decision: "verified" | "rejected"; note?: string }) =>
      api(`/api/admin/steps/${v.entryId}`, { method: "PATCH", json: { decision: v.decision, note: v.note } }),
    onSuccess: async (_d, v) => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success(v.decision === "verified" ? "Entry verified" : "Entry rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = useMutation({
    mutationFn: (next: "active" | "suspended") => api(`/api/admin/users/${id}`, { method: "PATCH", json: { status: next } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin"] });
      toast.success("User updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (error) return <EmptyState title="Could not load this user">{(error as Error).message}</EmptyState>;
  if (isLoading || !data) return <Skeleton className="h-96" />;

  const { user, summary } = data;
  const token = data.rewards[0]?.tokenSymbol ?? "USDG";
  const openPayout = data.payouts.find((p) => p.status === "prepared" || p.status === "submitted");

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All users
      </Link>

      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-lime-400/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <AddressAvatar address={user.walletAddress} className="h-14 w-14" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold">User #{user.shortId}</h1>
                <StatusBadge status={user.status} />
                {user.role === "admin" && <span className="rounded bg-lime-400/15 px-1.5 py-0.5 font-mono text-[10px] uppercase text-lime-300">admin</span>}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="break-all font-mono text-[13px] text-white/70">{user.walletAddress}</span>
                <button
                  aria-label="Copy address"
                  className="text-white/40 hover:text-white"
                  onClick={() => {
                    void navigator.clipboard.writeText(user.walletAddress);
                    toast.success("Address copied");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <a href={explorerAddressUrl(PAYOUT_CHAIN_ID, user.walletAddress) ?? "#"} target="_blank" rel="noreferrer" className="text-white/40 hover:text-lime-300">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="mt-1 text-[12px] text-white/40">
                Joined {fmtDate(user.createdAt, { month: "short", day: "numeric", year: "numeric" })} · last login{" "}
                {user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : "never"} · payout consent {user.payoutConsentAt ? "given" : "missing"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {openPayout ? (
              <Button onClick={() => setPayout(openPayout)} icon={<Send className="h-4 w-4" />}>
                Continue payout
              </Button>
            ) : (
              <Button disabled={summary.approved <= 0} loading={prepare.isPending} onClick={() => prepare.mutate(user.id)} icon={<Send className="h-4 w-4" />}>
                Prepare payout · {fmtAmount(summary.approved)} {token}
              </Button>
            )}
            <Button
              variant={user.status === "active" ? "danger" : "secondary"}
              loading={status.isPending}
              onClick={() => status.mutate(user.status === "active" ? "suspended" : "active")}
              icon={<Ban className="h-4 w-4" />}
            >
              {user.status === "active" ? "Suspend" : "Reactivate"}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total rewards" value={summary.total} prefix="$" suffix={token} icon={Coins} accent />
        <StatCard label="Pending review" value={summary.pending} prefix="$" suffix={token} icon={Hourglass} />
        <StatCard label="Approved, unpaid" value={summary.approved} prefix="$" suffix={token} icon={BadgeCheck} />
        <StatCard label="Paid" value={summary.paid} prefix="$" suffix={token} icon={CircleDollarSign} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="p-6 pb-4">
            <CardHeader label="Last 90 days" title="Registered steps" />
          </div>
          {data.steps.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState title="No steps registered" />
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 border-y border-white/10 bg-ink-900/95 backdrop-blur">
                  <tr>
                    <th className="table-head">Day</th>
                    <th className="table-head">Steps</th>
                    <th className="table-head">Source</th>
                    <th className="table-head">Status</th>
                    <th className="table-head text-right">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {data.steps.map((s) => (
                    <tr key={s.id} className="border-b border-white/5 last:border-0">
                      <td className="table-cell whitespace-nowrap">{fmtDate(s.day)}</td>
                      <td className="table-cell font-mono">
                        {fmtSteps(s.steps)}
                        {s.flags.length > 0 && <div className="text-[10.5px] text-amber-200/70">{s.flags.join(", ").replaceAll("_", " ")}</div>}
                      </td>
                      <td className="table-cell">
                        {s.source === "manual_demo" ? <DemoBadge>manual</DemoBadge> : <span className="text-[12.5px] text-white/70">{s.source.replace("_", " ")}</span>}
                      </td>
                      <td className="table-cell">
                        <StatusBadge status={s.verification} />
                      </td>
                      <td className="table-cell">
                        {s.verification === "unverified" || s.verification === "flagged" ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              className="grid h-8 w-8 place-items-center rounded-lg border border-lime-400/30 text-lime-300 hover:bg-lime-400/10"
                              title="Verify"
                              onClick={() => review.mutate({ entryId: s.id, decision: "verified", note: "Manually reviewed" })}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              className="grid h-8 w-8 place-items-center rounded-lg border border-red-400/30 text-red-300 hover:bg-red-500/10"
                              title="Reject"
                              onClick={() => {
                                const note = window.prompt("Reason for rejecting this entry?") ?? undefined;
                                if (note !== undefined) review.mutate({ entryId: s.id, decision: "rejected", note });
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-right text-[11px] text-white/35">{s.reviewedBy ? `by ${shortAddress(s.reviewedBy)}` : ""}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="p-6 pb-4">
              <CardHeader label="Allocations" title="Rewards" />
            </div>
            {data.rewards.length === 0 ? (
              <div className="px-6 pb-6">
                <EmptyState title="No rewards yet" />
              </div>
            ) : (
              <div className="max-h-[260px] overflow-y-auto">
                <table className="w-full">
                  <tbody>
                    {data.rewards.map((r) => (
                      <tr key={r.id} className="border-t border-white/5">
                        <td className="table-cell">{fmtDate(r.periodStart)}{r.periodEnd !== r.periodStart && ` to ${fmtDate(r.periodEnd)}`}</td>
                        <td className="table-cell font-mono text-white/60">{fmtSteps(r.validSteps)} steps</td>
                        <td className="table-cell font-mono text-lime-300">{fmtAmount(r.amount)}</td>
                        <td className="table-cell text-right">
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="p-6 pb-4">
              <CardHeader label="Transactions" title="Payouts" />
            </div>
            {data.payouts.length === 0 ? (
              <div className="px-6 pb-6">
                <EmptyState title="No payouts yet" />
              </div>
            ) : (
              <table className="w-full">
                <tbody>
                  {data.payouts.map((p) => {
                    const url = p.txHash ? explorerTxUrl(p.chainId, p.txHash) : null;
                    return (
                      <tr key={p.id} className="cursor-pointer border-t border-white/5 hover:bg-white/[0.03]" onClick={() => setPayout(p)}>
                        <td className="table-cell">{fmtDateTime(p.createdAt)}</td>
                        <td className="table-cell font-mono text-lime-300">
                          {fmtPayoutAmount(p)} {p.tokenSymbol}
                        </td>
                        <td className="table-cell">
                          <StatusBadge status={p.status} /> {p.simulated && <DemoBadge>sim</DemoBadge>}
                        </td>
                        <td className="table-cell text-right font-mono text-[12px]">
                          {url ? (
                            <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="hover:text-lime-300">
                              {shortAddress(p.txHash, 6, 4)}
                            </a>
                          ) : (
                            "None"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>

      <PayoutModal payout={payout} onClose={() => setPayout(null)} />
    </div>
  );
}
