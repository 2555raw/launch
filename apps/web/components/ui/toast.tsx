'use client';
import { create } from 'zustand';
import { X } from 'lucide-react';

interface Toast {
  id: number;
  title: string;
  body?: string;
  kind: 'info' | 'success' | 'error';
}
interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}
let seq = 1;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-5) }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.kind === 'error' ? 8000 : 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export const toast = {
  info: (title: string, body?: string) => useToasts.getState().push({ title, body, kind: 'info' }),
  success: (title: string, body?: string) => useToasts.getState().push({ title, body, kind: 'success' }),
  error: (title: string, body?: string) => useToasts.getState().push({ title, body, kind: 'error' }),
};

export function ToastHost() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto animate-rise rounded-xl border p-3 text-sm shadow-card backdrop-blur ${t.kind === 'error' ? 'border-rose-500/40 bg-rose-950/80' : t.kind === 'success' ? 'border-mint-500/40 bg-emerald-950/80' : 'border-white/10 bg-ink-800/90'}`}>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="font-semibold text-slate-100">{t.title}</div>
              {t.body && <div className="mt-0.5 text-xs text-slate-300 break-words">{t.body}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-white" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
