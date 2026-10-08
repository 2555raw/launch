"use client";

import type { Toast } from "@/hooks/useGame";

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto animate-toastIn rounded-lg border px-4 py-3 shadow-panel backdrop-blur ${
            t.kind === "achievement" ? "border-brand/40 bg-ink-900/95" : t.kind === "error" ? "border-burn/40 bg-ink-900/95" : "border-white/10 bg-ink-900/95"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="label">{t.kind === "achievement" ? "Achievement unlocked" : t.kind === "error" ? "Problem" : "Notice"}</div>
              <div className={`font-display text-lg font-semibold ${t.kind === "achievement" ? "text-brand-soft" : "text-slate-100"}`}>{t.title}</div>
              {t.body && <div className="text-sm text-slate-400">{t.body}</div>}
            </div>
            <button onClick={() => onDismiss(t.id)} className="text-slate-500 hover:text-slate-200" aria-label="dismiss">×</button>
          </div>
        </div>
      ))}
    </div>
  );
}
