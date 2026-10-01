"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Expand, ImageOff, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
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
  hasProof: boolean;
  createdAt: string;
}

const proofUrl = (id: string) => `/api/admin/steps/${id}/proof`;

export function StepsReviewView() {
  const qc = useQueryClient();
  const [zoom, setZoom] = useState<Entry | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "steps"], queryFn: () => api<{ entries: Entry[] }>("/api/admin/steps") });
  const review = useMutation({
    mutationFn: (v: { id: string; decision: "verified" | "rejected"; note?: string }) =>
      api(`/api/admin/steps/${v.id}`, { method: "PATCH", json: { decision: v.decision, note: v.note } }),
    onSuccess: async (d, v) => {
      const reward = (d as { entry?: { reward?: number | null } }).entry?.reward;
      toast.success(v.decision === "verified" ? "Steps verified" : "Upload rejected", {
        description: v.decision === "verified" && reward ? `$${reward.toFixed(2)} credited to the walker.` : undefined,
      });
      await qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = (e: Entry, decision: "verified" | "rejected") => {
    if (decision === "verified") return review.mutate({ id: e.id, decision, note: "Screenshot checked" });
    const note = window.prompt("Why are you rejecting this upload? The walker sees this reason.");
    if (note !== null) review.mutate({ id: e.id, decision, note });
  };

  return (
    <div>
      <PageHeader
        label="Step review"
        title="Verification queue"
        description="Each upload shows its screenshot. Verify only when the date and the step count in the photo match what the walker typed. Nothing is paid until it is verified."
        action={data ? <Badge tone={data.entries.length ? "amber" : "lime"}>{data.entries.length} waiting</Badge> : undefined}
      />

      {isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[520px]" />
          ))}
        </div>
      )}

      {data && data.entries.length === 0 && <EmptyState title="Queue is empty">New uploads and their screenshots appear here.</EmptyState>}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {data?.entries.map((e) => (
          <article key={e.id} className="glass flex flex-col overflow-hidden rounded-3xl">
            <button
              type="button"
              onClick={() => e.hasProof && setZoom(e)}
              className={cn("group relative block h-80 bg-black/40", e.hasProof && "cursor-zoom-in")}
              aria-label={e.hasProof ? "Open the screenshot full size" : "No screenshot"}
            >
              {e.hasProof ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={proofUrl(e.id)} alt={`Screenshot uploaded for ${e.day}`} loading="lazy" className="h-full w-full object-contain" />
                  <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-white/80 opacity-0 transition group-hover:opacity-100">
                    <Expand className="h-4 w-4" />
                  </span>
                </>
              ) : (
                <span className="flex h-full flex-col items-center justify-center gap-2 text-sm text-white/40">
                  <ImageOff className="h-6 w-6" />
                  {e.source === "manual_demo" ? "No screenshot" : `Sent by ${e.source.replace("_", " ")}`}
                </span>
              )}
            </button>

            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-3xl font-bold tabular">{fmtSteps(e.steps)}</div>
                  <div className="text-[13px] text-white/55">steps claimed for {fmtDate(e.day, { weekday: "long", month: "short", day: "numeric" })}</div>
                </div>
                {e.verification === "flagged" && <Badge tone="amber">flagged</Badge>}
              </div>
              {e.flags.length > 0 && <div className="mt-2 text-[12px] text-amber-200/80">{e.flags.join(", ").replaceAll("_", " ")}</div>}
              <Link href={`/admin/users/${e.userId}`} className="mt-3 text-[12.5px] text-white/50 hover:text-lime-300">
                Walker #{e.userShortId} · <span className="font-mono">{shortAddress(e.walletAddress)}</span> · sent {fmtDateTime(e.createdAt)}
              </Link>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
                <button
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/30 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-40"
                  disabled={review.isPending}
                  onClick={() => decide(e, "verified")}
                >
                  <CheckCircle2 className="h-4 w-4" /> Verify
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-red-400/30 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-40"
                  disabled={review.isPending}
                  onClick={() => decide(e, "rejected")}
                >
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={Boolean(zoom)}
        onClose={() => setZoom(null)}
        title={zoom ? `${fmtSteps(zoom.steps)} steps` : undefined}
        subtitle={zoom ? `${fmtDate(zoom.day, { weekday: "long", month: "short", day: "numeric" })} · walker #${zoom.userShortId}` : undefined}
      >
        {zoom && (
          <>
            <div className="grid max-h-[65vh] place-items-center overflow-auto rounded-2xl border border-white/10 bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proofUrl(zoom.id)} alt="Uploaded health app screenshot" className="max-h-[65vh] w-auto" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/30 text-sm text-emerald-300 hover:bg-emerald-400/10"
                onClick={() => {
                  decide(zoom, "verified");
                  setZoom(null);
                }}
              >
                <CheckCircle2 className="h-4 w-4" /> Matches · verify
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-red-400/30 text-sm text-red-300 hover:bg-red-500/10"
                onClick={() => {
                  decide(zoom, "rejected");
                  setZoom(null);
                }}
              >
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
