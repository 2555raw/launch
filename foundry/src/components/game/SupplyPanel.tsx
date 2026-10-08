"use client";

import type { GlobalSnapshot } from "@/lib/types";
import { fmtFull, fmtPct } from "@/lib/format";

/** The token supply the whole game is about. */
export function SupplyPanel({ global }: { global: GlobalSnapshot | null }) {
  if (!global) return <div className="panel h-40 animate-pulse" />;
  return (
    <section className="panel p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-bold tracking-wide text-brand-soft">${global.symbol}</h1>
        <span className="label">{global.commodity} token</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
        <Row label="Initial supply" value={fmtFull(global.initialSupply)} />
        <Row label="Burned" value={fmtFull(global.burnedSupply)} tone="text-red-300" />
        <Row label="Final supply" value={fmtFull(global.finalSupply)} tone="text-brand-soft" big />
      </div>
      <div className="mt-3 burn-bar">
        <div className="fill" style={{ width: `${Math.min(100, global.burnPercent)}%` }} />
        {global.maxBurnPercent < 100 && <div className="cap" style={{ left: `${global.maxBurnPercent}%` }} />}
      </div>
      <div className="mt-1.5 flex justify-between text-xs">
        <span className="font-display font-semibold uppercase tracking-wider text-ember">{fmtPct(global.burnPercent)} burned</span>
        <span className="text-slate-500">max {global.maxBurnPercent}%</span>
      </div>
    </section>
  );
}

function Row({ label, value, tone = "text-slate-200", big = false }: { label: string; value: string; tone?: string; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="label">{label}</span>
      <span className={`num ${tone} ${big ? "font-display text-xl font-bold" : "font-medium"}`}>{value}</span>
    </div>
  );
}
