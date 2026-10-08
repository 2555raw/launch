"use client";

import type { GameView } from "@/lib/types";
import type { LocalNumbers } from "@/hooks/useGame";
import { fmt } from "@/lib/format";

export function StatsBar({ server, local, unit }: { server: GameView; local: LocalNumbers; unit: string }) {
  const cursors = server.generators.filter((g) => ["cursor", "cursor2", "cursor3"].includes(g.id)).reduce((a, g) => a + g.count, 0);
  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
      <Stat label={`Balance (${unit})`} value={fmt(local.balance)} tone="text-brand-soft" />
      <Stat label="Production" value={`${fmt(server.productionPerSec)}/s`} />
      <Stat label="Burn power" value={`${fmt(server.burnPerSec)}/s`} tone="text-ember" />
      <Stat label="Your burn contribution" value={fmt(local.burnPower)} tone="text-red-300" />
      <Stat label="Cursors" value={cursors.toLocaleString("en-US")} />
      <Stat label="Clicks" value={Math.floor(local.totalClicks).toLocaleString("en-US")} />
    </section>
  );
}

function Stat({ label, value, tone = "text-slate-100" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="panel px-3 py-2">
      <div className="label truncate">{label}</div>
      <div className={`num font-display text-lg font-bold leading-tight ${tone}`}>{value}</div>
    </div>
  );
}
