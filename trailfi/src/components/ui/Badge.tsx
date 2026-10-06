import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "lime" | "neutral" | "amber" | "red" | "blue" | "green";

const tones: Record<Tone, string> = {
  lime: "border-lime-400/30 bg-lime-400/10 text-lime-300",
  green: "border-lime-400/30 bg-lime-400/10 text-lime-300",
  neutral: "border-white/10 bg-white/5 text-white/70",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  red: "border-red-400/30 bg-red-500/10 text-red-200",
  blue: "border-white/15 bg-white/[0.06] text-white/80",
};

export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em]",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  verified: "green",
  confirmed: "green",
  paid: "green",
  active: "green",
  approved: "lime",
  pending: "amber",
  requested: "amber",
  unverified: "neutral",
  prepared: "blue",
  submitted: "blue",
  processing: "blue",
  flagged: "amber",
  rejected: "red",
  failed: "red",
  cancelled: "neutral",
  suspended: "red",
  none: "neutral",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{status}</Badge>;
}

export function DemoBadge({ children = "Demo data" }: { children?: ReactNode }) {
  return (
    <Badge tone="amber" className="!tracking-[0.14em]">
      {children}
    </Badge>
  );
}
