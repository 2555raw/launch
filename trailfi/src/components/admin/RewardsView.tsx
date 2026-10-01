"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Calculator, Check, PlayCircle, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { fmtAmount, fmtDate, fmtSteps, shortAddress } from "@/lib/format";
import { useAdminMeta } from "./hooks";
import { PageHeader } from "./PageHeader";

interface Preview {
  periodStart: string;
  periodEnd: string;
  eligibleFees: number;
  pool: string;
  totalAllocated: string;
  unallocated: string;
  totalWeight: number;
  overlapsExisting: boolean;
  allocations: Array<{ userId: string; walletAddress: string | null; eligibleDays: number; validSteps: number; amount: string; capped: boolean }>;
}

interface RewardRow {
  id: string;
  userId: string;
  userShortId: number;
  walletAddress: string;
  periodStart: string;
  periodEnd: string;
  validSteps: number;
  eligibleDays: number;
  amount: number;
  capped: boolean;
  tokenSymbol: string;
  status: string;
  reviewedBy: string | null;
  rejectionReason: string | null;
}

function yesterday() {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}
function minusDays(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
}

const TABS = ["pending", "approved", "processing", "paid", "rejected", "all"] as const;

export function RewardsView() {
  const qc = useQueryClient();
  const { data: meta } = useAdminMeta();
  const settings = meta?.settings;
  const weekly = settings?.distributionFrequency === "weekly";

  const [end, setEnd] = useState(yesterday());
  const [start, setStart] = useState(yesterday());
  const [fees, setFees] = useState("100");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const periodStart = weekly ? start : end;
  const body = { periodStart, periodEnd: end, eligibleFees: Number(fees) };

  const previewM = useMutation({
    mutationFn: () => api<{ preview: Preview }>("/api/admin/distributions/preview", { method: "POST", json: body }),
    onSuccess: (d) => setPreview(d.preview),
    onError: (e: Error) => toast.error(e.message),
  });
  const createM = useMutation({
    mutationFn: () => api("/api/admin/distributions", { method: "POST", json: body }),
    onSuccess: async () => {
      toast.success("Distribution created", { description: "Rewards are pending your approval below." });
      setPreview(null);
      setTab("pending");
      await qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rewards = useQuery({
    queryKey: ["admin", "rewards", tab],
    queryFn: () => api<{ rewards: RewardRow[] }>(`/api/admin/rewards?status=${tab}`),
  });
  const rows = useMemo(() => rewards.data?.rewards ?? [], [rewards.data]);
  const pendingIds = rows.filter((r) => r.status === "pending").map((r) => r.id);

  const reviewM = useMutation({
    mutationFn: (v: { ids: string[]; decision: "approved" | "rejected"; reason?: string }) =>
      api<{ updated: number; skipped: number }>("/api/admin/rewards", { method: "PATCH", json: v }),
    onSuccess: async (d, v) => {
      toast.success(`${d.updated} reward${d.updated === 1 ? "" : "s"} ${v.decision}`);
      setSelected(new Set());
      await qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-6">
      <PageHeader
        label="Rewards"
        title="Distribute and approve rewards"
        description="Run the reward engine for a closed period, then approve or reject each allocation. Only approved rewards can be paid."
      />

      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="p-6 xl:col-span-2">
          <CardHeader label={`${settings?.distributionFrequency ?? "daily"} distribution`} title="Run the reward engine" />
          <div className="mt-5 space-y-4">
            <div className={cn("grid gap-3", weekly && "grid-cols-2")}>
              {weekly && (
                <label>
                  <span className="label mb-2 block">Period start</span>
                  <input type="date" className="input" value={start} max={end} min={minusDays(end, 6)} onChange={(e) => setStart(e.target.value)} />
                </label>
              )}
              <label>
                <span className="label mb-2 block">{weekly ? "Period end" : "Day (UTC)"}</span>
                <input type="date" className="input" value={end} max={yesterday()} onChange={(e) => setEnd(e.target.value)} />
              </label>
            </div>
            <label className="block">
              <span className="label mb-2 block">Token fees collected ({settings?.payoutTokenSymbol ?? "USDG"}, for the record)</span>
              <input type="number" min={0} step="0.01" className="input font-mono" value={fees} onChange={(e) => setFees(e.target.value)} />
            </label>
            {settings && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <Mini k={`${fmtSteps(settings.tierThreshold)} steps`} v={fmtAmount(settings.tierAvg)} />
                <Mini k={`${fmtSteps(settings.tierCap)}+ steps`} v={fmtAmount(settings.tierMax)} />
                <Mini k="Fees (record)" v={fmtAmount(Number(fees || 0))} />
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" loading={previewM.isPending} onClick={() => previewM.mutate()} icon={<Calculator className="h-4 w-4" />}>
                Preview
              </Button>
              <Button
                className="flex-1"
                disabled={!preview || preview.overlapsExisting || preview.allocations.length === 0}
                loading={createM.isPending}
                onClick={() => createM.mutate()}
                icon={<PlayCircle className="h-4 w-4" />}
              >
                Create
              </Button>
            </div>
            <p className="text-[11.5px] leading-relaxed text-white/40">
              Only verified step entries from active users are counted. Change the rules in{" "}
              <Link href="/admin/settings" className="text-lime-300 hover:underline">
                Settings
              </Link>
              .
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden xl:col-span-3">
          <div className="p-6 pb-4">
            <CardHeader label="Dry run" title="Preview" />
          </div>
          <AnimatePresence mode="wait">
            {!preview ? (
              <motion.div key="empty" className="px-6 pb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <EmptyState title="No preview yet">Pick a closed period and the eligible fees, then press Preview. Nothing is saved until you press Create.</EmptyState>
              </motion.div>
            ) : (
              <motion.div key="p" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="grid grid-cols-2 gap-2 px-6 sm:grid-cols-4">
                  <Mini k="Total to pay" v={fmtAmount(preview.pool)} accent />
                  <Mini k="Allocated" v={fmtAmount(preview.totalAllocated)} />
                  <Mini k="Unallocated" v={fmtAmount(preview.unallocated)} />
                  <Mini k="Walkers" v={String(preview.allocations.length)} />
                </div>
                {preview.overlapsExisting && (
                  <div className="mx-6 mt-4 rounded-xl border border-red-400/25 bg-red-500/[0.07] p-3 text-[13px] text-red-100">
                    A distribution already covers part of this period.
                  </div>
                )}
                <div className="mt-4 max-h-[300px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 border-y border-white/10 bg-ink-900/95">
                      <tr>
                        <th className="table-head">Wallet</th>
                        <th className="table-head">Days</th>
                        <th className="table-head">Valid steps</th>
                        <th className="table-head text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.allocations.length === 0 && (
                        <tr>
                          <td colSpan={4} className="table-cell text-center text-white/45">
                            No verified activity met the goal in this period.
                          </td>
                        </tr>
                      )}
                      {preview.allocations.map((a) => (
                        <tr key={a.userId} className="border-b border-white/5">
                          <td className="table-cell font-mono text-[13px]">{shortAddress(a.walletAddress)}</td>
                          <td className="table-cell">{a.eligibleDays}</td>
                          <td className="table-cell font-mono">{fmtSteps(a.validSteps)}</td>
                          <td className="table-cell text-right font-mono text-lime-300">
                            {fmtAmount(a.amount)} {a.capped && <span className="text-[10px] text-amber-200">cap</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col justify-between gap-4 p-6 pb-4 md:flex-row md:items-center">
          <CardHeader label="Review" title="Reward allocations" />
          <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setSelected(new Set());
                }}
                className={cn("shrink-0 rounded-xl px-3 py-1.5 text-[12.5px] font-medium capitalize", tab === t ? "bg-lime-400 text-forest-950" : "text-white/60 hover:text-white")}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-y border-lime-400/20 bg-lime-400/[0.05]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                <span className="text-sm">{selected.size} selected</span>
                <div className="flex gap-2">
                  <Button size="sm" loading={reviewM.isPending} onClick={() => reviewM.mutate({ ids: [...selected], decision: "approved" })} icon={<Check className="h-3.5 w-3.5" />}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      const reason = window.prompt("Reason for rejecting these rewards?");
                      if (reason) reviewM.mutate({ ids: [...selected], decision: "rejected", reason });
                    }}
                    icon={<X className="h-3.5 w-3.5" />}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="border-y border-white/10 bg-white/[0.02]">
              <tr>
                <th className="table-head w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all pending"
                    className="h-4 w-4 accent-lime-400"
                    disabled={pendingIds.length === 0}
                    checked={pendingIds.length > 0 && pendingIds.every((i) => selected.has(i))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(pendingIds) : new Set())}
                  />
                </th>
                <th className="table-head">User</th>
                <th className="table-head">Period</th>
                <th className="table-head">Valid steps</th>
                <th className="table-head">Amount</th>
                <th className="table-head">Status</th>
                <th className="table-head text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rewards.isLoading && (
                <tr>
                  <td colSpan={7} className="table-cell">
                    <Skeleton className="h-8" />
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className={cn("border-b border-white/5 last:border-0", selected.has(r.id) && "bg-lime-400/[0.04]")}>
                  <td className="table-cell">
                    {r.status === "pending" && <input type="checkbox" className="h-4 w-4 accent-lime-400" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />}
                  </td>
                  <td className="table-cell">
                    <Link href={`/admin/users/${r.userId}`} className="hover:text-lime-300">
                      <span className="text-white/50">#{r.userShortId}</span> <span className="font-mono text-[13px]">{shortAddress(r.walletAddress)}</span>
                    </Link>
                  </td>
                  <td className="table-cell">
                    {fmtDate(r.periodStart)}
                    {r.periodEnd !== r.periodStart && ` to ${fmtDate(r.periodEnd)}`}
                  </td>
                  <td className="table-cell font-mono">{fmtSteps(r.validSteps)}</td>
                  <td className="table-cell font-mono text-lime-300">
                    {fmtAmount(r.amount)} <span className="text-white/35">{r.tokenSymbol}</span>
                    {r.capped && <span className="ml-1 text-[10px] text-amber-200">cap</span>}
                  </td>
                  <td className="table-cell">
                    <StatusBadge status={r.status} />
                    {r.rejectionReason && <div className="mt-1 max-w-[200px] truncate text-[11px] text-white/40">{r.rejectionReason}</div>}
                  </td>
                  <td className="table-cell">
                    {r.status === "pending" && (
                      <div className="flex justify-end gap-1.5">
                        <button className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-400/30 text-emerald-300 hover:bg-emerald-400/10" title="Approve" onClick={() => reviewM.mutate({ ids: [r.id], decision: "approved" })}>
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          className="grid h-8 w-8 place-items-center rounded-lg border border-red-400/30 text-red-300 hover:bg-red-500/10"
                          title="Reject"
                          onClick={() => {
                            const reason = window.prompt("Reason for rejecting this reward?");
                            if (reason) reviewM.mutate({ ids: [r.id], decision: "rejected", reason });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rewards.isLoading && rows.length === 0 && (
          <div className="p-6">
            <EmptyState title={`No ${tab === "all" ? "" : tab} rewards`} />
          </div>
        )}
      </Card>

      {meta && meta.distributions.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-6 pb-4">
            <CardHeader label="History" title="Distributions" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-y border-white/10 bg-white/[0.02]">
                <tr>
                  <th className="table-head">Period</th>
                  <th className="table-head">Token fees</th>
                  <th className="table-head">Rates</th>
                  <th className="table-head">Pool</th>
                  <th className="table-head">Allocated</th>
                  <th className="table-head">Walkers</th>
                  <th className="table-head">Run by</th>
                </tr>
              </thead>
              <tbody>
                {meta.distributions.map((d) => (
                  <tr key={d.id} className="border-b border-white/5 last:border-0">
                    <td className="table-cell">
                      {fmtDate(d.periodStart)}
                      {d.periodEnd !== d.periodStart && ` to ${fmtDate(d.periodEnd)}`}
                    </td>
                    <td className="table-cell font-mono">{fmtAmount(d.eligibleFees)}</td>
                    <td className="table-cell">tiers</td>
                    <td className="table-cell font-mono">{fmtAmount(d.pool)}</td>
                    <td className="table-cell font-mono text-lime-300">{fmtAmount(d.totalAllocated)}</td>
                    <td className="table-cell">{d.participants}</td>
                    <td className="table-cell font-mono text-[12px] text-white/50">{shortAddress(d.createdBy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Mini({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border px-3 py-2.5", accent ? "border-lime-400/25 bg-lime-400/[0.06]" : "border-white/10 bg-white/[0.03]")}>
      <div className="label !text-[9.5px]">{k}</div>
      <div className={cn("mt-0.5 font-mono text-sm font-semibold", accent && "text-lime-300")}>{v}</div>
    </div>
  );
}
