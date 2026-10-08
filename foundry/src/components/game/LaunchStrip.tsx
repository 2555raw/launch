"use client";

import { useEffect, useState } from "react";
import type { GlobalSnapshot } from "@/lib/types";
import { fmt, fmtDuration, fmtFull, fmtPct } from "@/lib/format";
import { Flame } from "@/components/ui/Icons";

export function statusLabel(s: GlobalSnapshot["status"]) {
  switch (s) {
    case "DRAFT": return "WARM-UP · COUNTDOWN NOT STARTED";
    case "ACTIVE": return "LAUNCH WINDOW OPEN";
    case "FROZEN": return "FROZEN · FINALIZING SUPPLY";
    case "FINALIZED": return "SUPPLY LOCKED · AWAITING MINT";
    case "MINTING": return "MINTING ON SOLANA";
    case "LAUNCHED": return "TOKEN LAUNCHED";
    case "FAILED": return "ON-CHAIN STEP FAILED · RETRYING";
  }
}

export function useCountdown(global: GlobalSnapshot | null, serverNow: () => number) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      if (!global?.endsAt || global.status !== "ACTIVE") return setLeft(null);
      setLeft(global.endsAt - serverNow());
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [global, serverNow]);
  return left;
}

/** Community-wide launch state: the bar everyone is filling together. */
export function LaunchStrip({ global, serverNow, connected }: { global: GlobalSnapshot | null; serverNow: () => number; connected: boolean }) {
  const left = useCountdown(global, serverNow);
  if (!global) return <div className="panel h-[92px] animate-pulse" />;
  const capPct = global.maxBurnPercent;
  return (
    <section className="panel overflow-hidden">
      <div className="grid gap-4 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-ember" />
              <span className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                Global ${global.symbol} launch
              </span>
              <span className="chip">{statusLabel(global.status)}</span>
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} title={connected ? "live" : "polling"} />
            </div>
            <div className="font-display text-sm text-slate-400">
              <span className="num text-red-300">{fmtFull(global.burnedSupply)}</span> burned ·{" "}
              <span className="num text-slate-200">{fmtFull(global.finalSupply)}</span> remain
            </div>
          </div>
          <div className="mt-2 burn-bar" aria-label="burn progress">
            <div className="fill" style={{ width: `${Math.min(100, global.burnPercent)}%` }} />
            {capPct < 100 && <div className="cap" style={{ left: `${capPct}%` }} title={`max burn ${capPct}%`} />}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400">
            <span><span className="num text-ember font-semibold">{fmtPct(global.burnPercent)}</span> of supply burned</span>
            <span>cap <span className="num">{capPct}%</span></span>
            <span><span className="num text-slate-200">{fmt(global.totalClicks, 1)}</span> community clicks</span>
            <span><span className="num text-slate-200">{fmt(global.productionPerSec, 1)}</span>/sec community production</span>
            <span><span className="num text-slate-200">{global.activePlayers}</span> online · <span className="num">{global.players}</span> players</span>
          </div>
        </div>
        <div className="text-right">
          <div className="label">{global.status === "ACTIVE" ? "Launch in" : global.status === "DRAFT" ? "Countdown" : "Launch"}</div>
          <div className="num font-display text-3xl font-bold leading-none text-slate-100">
            {global.status === "ACTIVE" && left !== null ? fmtDuration(left) : global.status === "DRAFT" ? "NOT STARTED" : global.status === "LAUNCHED" ? "COMPLETE" : "CLOSED"}
          </div>
          {global.status === "ACTIVE" && <div className="mt-1 text-[11px] text-slate-500">window {global.launchProgress.toFixed(1)}% elapsed</div>}
        </div>
      </div>
    </section>
  );
}
