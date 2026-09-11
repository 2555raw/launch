import type { ReactNode } from "react";

/** Uppercase mono eyebrow. Every section is announced by one. */
export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`label ${className}`}>{children}</span>;
}

type Tone = "live" | "approved" | "blocked" | "policy" | "idle";

const tones: Record<Tone, { dot: string; text: string; ring: string }> = {
  live: { dot: "bg-coral", text: "text-coral", ring: "border-coral/30" },
  approved: { dot: "bg-positive", text: "text-positive", ring: "border-positive/30" },
  blocked: { dot: "bg-ink", text: "text-ink", ring: "border-hairStrong" },
  policy: { dot: "bg-violet", text: "text-violet", ring: "border-violet/30" },
  idle: { dot: "bg-muted", text: "text-muted", ring: "border-hair" },
};

/**
 * State reads as shape and colour, not only as a word: the pill carries a dot,
 * and the live dot is the single thing on the page that keeps moving.
 */
export function Status({
  tone,
  children,
  pulse = false,
}: {
  tone: Tone;
  children: ReactNode;
  pulse?: boolean;
}) {
  const t = tones[tone];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-pill border ${t.ring} bg-canvas/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${t.text}`}
    >
      <i className={`h-1.5 w-1.5 rounded-full ${t.dot} ${pulse ? "animate-pulseDot" : ""}`} />
      {children}
    </span>
  );
}

/** A hairline rule that also carries a label, used to open sections. */
export function RuleLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-5 border-t border-hair pt-5">
      <Label>{children}</Label>
    </div>
  );
}
