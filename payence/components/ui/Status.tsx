import type { ReactNode } from "react";

export type Tone = "neutral" | "positive" | "warning" | "danger" | "info" | "live";

const tones: Record<Tone, string> = {
  neutral: "border-hair bg-shell text-muted",
  positive: "border-positive/25 bg-positive-soft text-positive",
  warning: "border-warning/25 bg-warning-soft text-warning",
  danger: "border-danger/25 bg-danger-soft text-danger",
  info: "border-hairStrong bg-surface text-ink",
  live: "border-coral/25 bg-coral-soft text-coral",
};

/** Status reads as shape and colour, never colour alone: every pill carries a dot and a word. */
export function Badge({ tone = "neutral", children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}
    >
      {dot && <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone === "live" ? "bg-coral animate-pulseDot" : "bg-current"}`} />}
      {children}
    </span>
  );
}

export const TX_STATUS: Record<string, { label: string; tone: Tone; help: string }> = {
  pending: { label: "Pending", tone: "warning", help: "Waiting to start. Nothing has moved yet." },
  processing: { label: "Processing", tone: "warning", help: "Submitted and waiting for confirmation." },
  completed: { label: "Completed", tone: "positive", help: "Settled. The money has moved." },
  failed: { label: "Failed", tone: "danger", help: "Nothing was charged. You can try again." },
  cancelled: { label: "Cancelled", tone: "neutral", help: "Stopped before any money moved." },
  expired: { label: "Expired", tone: "neutral", help: "The payment window closed before it was paid." },
};

export function TxStatusBadge({ status }: { status: string }) {
  const s = TX_STATUS[status] ?? TX_STATUS.pending;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
