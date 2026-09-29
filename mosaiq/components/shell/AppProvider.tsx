"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PublicAgent } from "@/lib/types";
import { CommandPalette } from "./CommandPalette";
import { ConnectAgentDialog } from "./ConnectAgentDialog";
import { DisclosureGate } from "./DisclosureGate";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

interface AppState {
  agent: PublicAgent | null;
  setAgent: (a: PublicAgent | null) => void;
  openPalette: () => void;
  openConnect: () => void;
  toast: (t: Omit<Toast, "id">) => void;
}

const Ctx = createContext<AppState | null>(null);
const AGENT_KEY = "mosaiq.agent";

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [agent, setAgentState] = useState<PublicAgent | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  // Remember which agent this browser connected (its public half only; the key is never stored).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AGENT_KEY);
      if (raw) setAgentState(JSON.parse(raw));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const setAgent = useCallback((a: PublicAgent | null) => {
    setAgentState(a);
    try {
      if (a) localStorage.setItem(AGENT_KEY, JSON.stringify(a));
      else localStorage.removeItem(AGENT_KEY);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++seq.current;
    setToasts((all) => [...all.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.id !== id)), 4200);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      agent,
      setAgent,
      toast,
      openPalette: () => setPaletteOpen(true),
      openConnect: () => setConnectOpen(true),
    }),
    [agent, setAgent, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ConnectAgentDialog open={connectOpen} onOpenChange={setConnectOpen} />
      <DisclosureGate />
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              role={t.kind === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line-strong bg-surface-2/95 p-4 shadow-2xl shadow-black/50 backdrop-blur"
            >
              {t.kind === "error" ? (
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
              ) : (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-mint" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.body && <p className="mt-0.5 text-[13px] text-fog">{t.body}</p>}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
                className="-m-1 rounded-md p-1 text-mute hover:text-bone"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
