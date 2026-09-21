import type { ReactNode } from "react";
import { Icon } from "./Icons";

type Tone = "error" | "warning" | "success" | "info";

const styles: Record<Tone, { box: string; icon: ReactNode }> = {
  error: { box: "border-danger/25 bg-danger-soft text-danger", icon: <Icon.close className="h-4 w-4" /> },
  warning: { box: "border-warning/25 bg-warning-soft text-warning", icon: <Icon.clock className="h-4 w-4" /> },
  success: { box: "border-positive/25 bg-positive-soft text-positive", icon: <Icon.check className="h-4 w-4" /> },
  info: { box: "border-hair bg-shell text-ink", icon: <Icon.shield className="h-4 w-4" /> },
};

/** The one way this app reports a problem. There are no browser alerts anywhere. */
export function Alert({ tone = "info", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  const s = styles[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex gap-3 rounded-xl border px-4 py-3.5 text-[13.5px] leading-relaxed ${s.box}`}
    >
      <span className="mt-0.5 shrink-0">{s.icon}</span>
      <span className="min-w-0">
        {title && <strong className="mr-1.5 font-semibold">{title}</strong>}
        {children}
      </span>
    </div>
  );
}
