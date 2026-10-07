"use client";

import { Download, Share, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallState {
  /** True when Strydo already runs as an installed app. */
  installed: boolean;
  /** True when the browser can install it, or it's an iPhone/iPad where we show the steps. */
  available: boolean;
  install: () => void;
}

const InstallContext = createContext<InstallState>({ installed: false, available: false, install: () => {} });
export const useInstallApp = () => useContext(InstallContext);

const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** Registers the service worker and offers "Install app" where the browser supports it. */
export function InstallAppProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(() => {
    if (prompt) {
      void prompt.prompt();
      void prompt.userChoice.finally(() => setPrompt(null));
    } else if (ios) {
      setIosHelp(true);
    }
  }, [prompt, ios]);

  return (
    <InstallContext.Provider value={{ installed, available: !installed && (Boolean(prompt) || ios), install }}>
      {children}
      <Modal open={iosHelp} onClose={() => setIosHelp(false)} title="Add Strydo to your Home Screen" subtitle="It opens full screen like an app, and can remind you to upload your steps.">
        <ol className="space-y-3 text-[14.5px] text-white/80">
          <li className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime-400 font-bold text-ink-950">1</span>
            <span>
              Tap <Share className="mx-1 inline h-4 w-4 text-lime-300" /> <b>Share</b> at the bottom of Safari.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime-400 font-bold text-ink-950">2</span>
            <span>
              Choose <b>Add to Home Screen</b>.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime-400 font-bold text-ink-950">3</span>
            <span>
              Tap <b>Add</b>, then open Strydo from your Home Screen.
            </span>
          </li>
        </ol>
      </Modal>
    </InstallContext.Provider>
  );
}

/** A small "Install app" button; renders nothing when installing isn't possible or already done. */
export function InstallAppButton({ className }: { className?: string }) {
  const { available, install } = useInstallApp();
  if (!available) return null;
  return (
    <button
      onClick={install}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[13px] text-white/75 transition hover:border-lime-400/40 hover:text-lime-300"
      }
    >
      <Download className="h-3.5 w-3.5" /> Install app
    </button>
  );
}

/** One-time banner on phones offering to install Strydo. Dismissal is remembered on the device. */
export function InstallBanner() {
  const { available, install } = useInstallApp();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("strydo:install-dismissed") === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  if (!available || hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem("strydo:install-dismissed", "1");
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 flex items-center gap-3 rounded-2xl border border-lime-400/30 bg-ink-900/95 p-3 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/app/icon-192.png" alt="" className="h-11 w-11 rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold">Get the Strydo app</div>
        <div className="text-[12px] text-white/55">Opens full screen, with daily reminders.</div>
      </div>
      <button onClick={install} className="rounded-xl bg-lime-400 px-3.5 py-2 text-[13px] font-semibold text-ink-950">
        Install
      </button>
      <button onClick={dismiss} aria-label="Dismiss" className="p-1 text-white/45">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
