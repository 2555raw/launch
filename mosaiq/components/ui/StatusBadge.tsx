import { cn } from "@/lib/cn";
import type { LaunchStatus } from "@/lib/types";

const styles: Record<LaunchStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "text-fog border-line-strong" },
  queued: { label: "Queued", cls: "text-amber border-amber/30 bg-amber/5" },
  live: { label: "Live", cls: "text-mint border-mint/30 bg-mint/5" },
  failed: { label: "Failed", cls: "text-danger border-danger/30 bg-danger/5" },
};

export function StatusBadge({ status, className }: { status: LaunchStatus; className?: string }) {
  const s = styles[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider", s.cls, className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}
