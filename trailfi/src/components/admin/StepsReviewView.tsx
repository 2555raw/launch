"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { DemoBadge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/fetcher";
import { fmtDate, fmtDateTime, fmtSteps, shortAddress } from "@/lib/format";
import { PageHeader } from "./PageHeader";

interface Entry {
  id: string;
  userId: string;
  userShortId: number;
  walletAddress: string;
  day: string;
  steps: number;
  source: string;
  verification: string;
  flags: string[];
  createdAt: string;
}

export function StepsReviewView() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin", "steps"], queryFn: () => api<{ entries: Entry[] }>("/api/admin/steps") });
  const review = useMutation({
    mutationFn: (v: { id: string; decision: "verified" | "rejected"; note?: string }) =>
      api(`/api/admin/steps/${v.id}`, { method: "PATCH", json: { decision: v.decision, note: v.note } }),
    onSuccess: async (_d, v) => {
      toast.success(v.decision === "verified" ? "Entry verified" : "Entry rejected");
      await qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        label="Step review"
        title="Verification queue"
        description="Browser-submitted and flagged entries are never paid until reviewed here. Verify only activity you can substantiate (e.g. a screenshot or export from the user's health app)."
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="table-head">User</th>
                <th className="table-head">Day</th>
                <th className="table-head">Steps</th>
                <th className="table-head">Source</th>
                <th className="table-head">Flags</th>
                <th className="table-head">Status</th>
                <th className="table-head text-right">Decision</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="table-cell">
                    <Skeleton className="h-8" />
                  </td>
                </tr>
              )}
              {data?.entries.map((e) => (
                <tr key={e.id} className="border-b border-white/5 last:border-0">
                  <td className="table-cell">
                    <Link href={`/admin/users/${e.userId}`} className="hover:text-lime-300">
                      <span className="text-white/50">#{e.userShortId}</span> <span className="font-mono text-[13px]">{shortAddress(e.walletAddress)}</span>
                    </Link>
                  </td>
                  <td className="table-cell">
                    {fmtDate(e.day)}
                    <div className="text-[11px] text-white/35">sent {fmtDateTime(e.createdAt)}</div>
                  </td>
                  <td className="table-cell font-mono">{fmtSteps(e.steps)}</td>
                  <td className="table-cell">{e.source === "manual_demo" ? <DemoBadge>manual</DemoBadge> : e.source.replace("_", " ")}</td>
                  <td className="table-cell text-[12px] text-amber-200/80">{e.flags.length ? e.flags.join(", ").replaceAll("_", " ") : "—"}</td>
                  <td className="table-cell">
                    <StatusBadge status={e.verification} />
                  </td>
                  <td className="table-cell">
                    <div className="flex justify-end gap-1.5">
                      <button
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-400/30 px-2.5 text-[12.5px] text-emerald-300 hover:bg-emerald-400/10"
                        onClick={() => review.mutate({ id: e.id, decision: "verified", note: "Manually reviewed" })}
                      >
                        <CheckCircle2 className="h-4 w-4" /> Verify
                      </button>
                      <button
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-400/30 px-2.5 text-[12.5px] text-red-300 hover:bg-red-500/10"
                        onClick={() => {
                          const note = window.prompt("Reason for rejecting this entry?");
                          if (note !== null) review.mutate({ id: e.id, decision: "rejected", note });
                        }}
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.entries.length === 0 && (
          <div className="p-6">
            <EmptyState title="Queue is empty">All step entries have been reviewed.</EmptyState>
          </div>
        )}
      </Card>
    </div>
  );
}
