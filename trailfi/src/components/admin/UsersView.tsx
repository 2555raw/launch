"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Skeleton";
import { AddressAvatar } from "@/components/wallet/ConnectWallet";
import { cn } from "@/lib/cn";
import { api } from "@/lib/fetcher";
import { fmtAmount, fmtSteps, shortAddress } from "@/lib/format";
import { useAdminMeta, type Payout } from "./hooks";
import { PageHeader } from "./PageHeader";
import { PayoutModal } from "./PayoutModal";
import { usePreparePayout } from "./usePreparePayout";

interface UserRow {
  id: string;
  shortId: number;
  walletAddress: string;
  role: string;
  status: string;
  dailySteps: number;
  todayVerification: string | null;
  totalRewards: number;
  pendingRewards: number;
  approvedRewards: number;
  processingRewards: number;
  paidRewards: number;
  paymentStatus: "none" | "pending" | "approved" | "processing" | "paid";
}

const FILTERS = ["all", "pending", "approved", "processing", "paid", "none"] as const;
const PAYMENT_LABEL: Record<string, string> = {
  none: "none",
  pending: "pending",
  approved: "approved",
  processing: "processing",
  paid: "paid",
};

export function UsersView() {
  const params = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const status = (params.get("status") as (typeof FILTERS)[number]) ?? "all";
  const { data: meta } = useAdminMeta();
  const token = meta?.settings.payoutTokenSymbol ?? "USDG";
  const [payout, setPayout] = useState<Payout | null>(null);
  const prepare = usePreparePayout(setPayout);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", status, search],
    queryFn: () => api<{ users: UserRow[] }>(`/api/admin/users?status=${status}&search=${encodeURIComponent(search)}`),
  });

  return (
    <div>
      <PageHeader label="Users" title="Registered walkers" description="Wallet addresses, activity and reward balances. Open a profile to review steps or prepare a payout." />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input className="input pl-10" placeholder="Search wallet or user ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => router.replace(f === "all" ? "/admin/users" : `/admin/users?status=${f}`)}
              className={cn(
                "shrink-0 rounded-xl px-3 py-1.5 text-[12.5px] font-medium capitalize transition",
                status === f ? "bg-lime-400 text-forest-950" : "text-white/60 hover:text-white",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="table-head">User ID</th>
                <th className="table-head">Wallet Address</th>
                <th className="table-head">Daily Steps</th>
                <th className="table-head">Total Rewards</th>
                <th className="table-head">Pending Rewards</th>
                <th className="table-head">Payment Status</th>
                <th className="table-head text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="table-cell">
                      <Skeleton className="h-7" />
                    </td>
                  </tr>
                ))}
              {data?.users.map((u) => (
                <tr key={u.id} className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.025]">
                  <td className="table-cell font-mono text-white/60">#{u.shortId}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <AddressAvatar address={u.walletAddress} />
                      <span className="font-mono text-[13px]" title={u.walletAddress}>
                        {shortAddress(u.walletAddress, 8, 6)}
                      </span>
                      {u.role === "admin" && <span className="rounded bg-lime-400/15 px-1.5 py-0.5 font-mono text-[9.5px] uppercase text-lime-300">admin</span>}
                      {u.status === "suspended" && <StatusBadge status="suspended" />}
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="font-mono">{fmtSteps(u.dailySteps)}</span>
                    {u.todayVerification && u.todayVerification !== "verified" && (
                      <span className="ml-2 text-[11px] text-amber-200/70">{u.todayVerification}</span>
                    )}
                  </td>
                  <td className="table-cell font-mono">
                    {fmtAmount(u.totalRewards)} <span className="text-white/35">{token}</span>
                  </td>
                  <td className="table-cell font-mono">
                    {fmtAmount(u.pendingRewards + u.approvedRewards)} <span className="text-white/35">{token}</span>
                    {u.approvedRewards > 0 && <div className="text-[11px] text-lime-300/80">{fmtAmount(u.approvedRewards)} approved</div>}
                  </td>
                  <td className="table-cell">
                    <StatusBadge status={PAYMENT_LABEL[u.paymentStatus]} />
                  </td>
                  <td className="table-cell">
                    <div className="flex justify-end gap-2">
                      {u.paymentStatus === "approved" && (
                        <Button
                          size="sm"
                          loading={prepare.isPending && prepare.variables === u.id}
                          onClick={() => prepare.mutate(u.id)}
                          icon={<Send className="h-3.5 w-3.5" />}
                        >
                          Pay
                        </Button>
                      )}
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/10 px-3 text-[13px] text-white/75 transition hover:border-lime-400/40 hover:text-lime-300"
                      >
                        Profile <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.users.length === 0 && (
          <div className="p-6">
            <EmptyState title="No users match">Users appear here after their first wallet login.</EmptyState>
          </div>
        )}
      </Card>

      <PayoutModal payout={payout} onClose={() => setPayout(null)} />
    </div>
  );
}
