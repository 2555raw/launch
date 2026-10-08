"use client";

import { useEffect, useMemo, useState } from "react";
import type { GlobalSnapshot } from "@/lib/types";
import { fmt, fmtFull } from "@/lib/format";

const FLAVOR = [
  "Market desk: supply removed at launch is permanent; the burn transaction is published on the project page.",
  "Operations: cursor tiers raise extraction cadence; buildings add automated output with their own burn weight.",
  "Treasury note: a fixed share of the final supply is reserved for players, pro rata to burn power.",
  "Compliance: every click batch is validated server-side; clicks above the per-second cap are discarded.",
  "Engineering: Burn Protocol upgrades double the burn weight of all your production.",
  "Launch desk: when the countdown ends the ledger freezes and the final supply is locked before minting.",
];

export function NewsTicker({ global, bare = false }: { global: GlobalSnapshot | null; bare?: boolean }) {
  const items = useMemo(() => {
    if (!global) return FLAVOR;
    const g = global;
    return [
      `The community has burned ${fmtFull(g.burnedSupply)} $${g.symbol} so far (${g.burnPercent.toFixed(2)}% of supply).`,
      `${g.players.toLocaleString("en-US")} players have joined the $${g.symbol} launch. ${g.activePlayers} are producing right now.`,
      `Community production: ${fmt(g.productionPerSec)} per second. Community clicks: ${fmt(g.totalClicks, 1)}.`,
      `Final supply currently stands at ${fmtFull(g.finalSupply)} $${g.symbol}.`,
      ...FLAVOR,
    ];
  }, [global]);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [items.length]);
  if (bare) return <span key={i} className="animate-toastIn">{items[i % items.length]}</span>;
  return (
    <div className="panel flex items-center gap-3 px-4 py-2 text-sm">
      <span className="label shrink-0 text-ember">News</span>
      <span key={i} className="animate-toastIn truncate text-slate-300">{items[i % items.length]}</span>
    </div>
  );
}
