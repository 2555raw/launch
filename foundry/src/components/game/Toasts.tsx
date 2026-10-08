"use client";

import type { Toast } from "@/hooks/useGame";

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto animate-toastIn cc-toast ${t.kind === "error" ? "!border-red-900" : ""}`}>
          <div className="cc-toast-icon shrink-0">
            {t.kind === "achievement" ? <span className="text-xl">★</span> : t.kind === "error" ? <span className="text-xl text-red-200">!</span> : <span className="text-xl">i</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold text-white">{t.kind === "achievement" ? "Achievement unlocked" : t.kind === "error" ? "Problem" : "Notice"}</div>
            <div className={`text-lg font-black leading-tight ${t.kind === "achievement" ? "text-[#ffd98a]" : "text-slate-100"}`}>{t.title}</div>
            {t.body && <div className="text-xs text-slate-400">{t.body}</div>}
          </div>
          <button onClick={() => onDismiss(t.id)} className="self-start text-slate-400 hover:text-white" aria-label="dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
