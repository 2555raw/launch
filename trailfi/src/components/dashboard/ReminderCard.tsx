"use client";

import { BellRing, BellOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { InstallAppButton, useInstallApp } from "@/components/providers/InstallApp";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

type Support = "checking" | "ok" | "needs-install" | "unsupported" | "blocked";

/** Daily reminder toggle: a notification in the evening on days without an upload. One device at a time. */
export function ReminderCard() {
  const { installed } = useInstallApp();
  const [support, setSupport] = useState<Support>("checking");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setSupport(ios && !installed ? "needs-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setSupport("blocked");
      return;
    }
    setSupport("ok");
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(async (sub) => {
        if (!sub) return;
        const res = await fetch(`/api/me/reminders?endpoint=${encodeURIComponent(sub.endpoint)}`);
        if (res.ok) setEnabled((await res.json()).enabled);
      })
      .catch(() => undefined);
  }, [installed]);

  const turnOn = async () => {
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setSupport("blocked");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { key } = await (await fetch("/api/push-key")).json();
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) }));
      const res = await fetch("/api/me/reminders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", hour: 19 }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not turn reminders on");
      setEnabled(true);
      toast.success("Daily reminder on", { description: "We'll nudge you at 7 pm on days you haven't uploaded." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/me/reminders", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setEnabled(false);
      toast("Daily reminder off");
    } finally {
      setBusy(false);
    }
  };

  if (support === "checking" || support === "unsupported") return null;

  return (
    <Card className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
      <div className="flex items-center gap-4">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", enabled ? "bg-lime-400 text-ink-950" : "bg-white/5 text-white/50")}>
          {enabled ? <BellRing className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </span>
        <div>
          <div className="font-display text-lg font-semibold">Daily reminder</div>
          <div className="text-[13px] text-white/55">
            {support === "needs-install"
              ? "On iPhone, add Stepit to your Home Screen first, then turn reminders on from the app."
              : support === "blocked"
                ? "Notifications are blocked for Stepit. Allow them in your browser settings to get reminders."
                : enabled
                  ? "On: a notification at 7 pm on days you haven't uploaded yet."
                  : "Get a notification at 7 pm on days you haven't uploaded your steps yet."}
          </div>
        </div>
      </div>
      {support === "needs-install" ? (
        <InstallAppButton className="inline-flex items-center gap-1.5 rounded-xl bg-lime-400 px-4 py-2.5 text-[14px] font-semibold text-ink-950" />
      ) : support === "ok" ? (
        <button
          onClick={enabled ? turnOff : turnOn}
          disabled={busy}
          className={cn(
            "inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold transition disabled:opacity-60",
            enabled ? "border border-white/15 text-white/80 hover:border-red-400/40 hover:text-red-200" : "bg-lime-400 text-ink-950 hover:bg-lime-300",
          )}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {enabled ? "Turn off" : "Turn on"}
        </button>
      ) : null}
    </Card>
  );
}
