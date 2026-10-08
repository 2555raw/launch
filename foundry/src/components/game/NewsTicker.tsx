"use client";

import { useEffect, useMemo, useState } from "react";
import type { GlobalSnapshot } from "@/lib/types";
import { fmt, fmtFull } from "@/lib/format";

const FLAVOR = [
  "Analysts confirm: every click is, technically, monetary policy.",
  "Local cursor union demands shorter seconds.",
  "Refinery smoke now visible from the trading floor. Traders delighted.",
  "Economist: \"Burning supply before launch is either genius or a very warm idea.\"",
  "Orbital Smelter operators report asteroid ore is \"mostly fine\".",
  "Community reminder: the burn is final once the countdown ends.",
  "Vault managers insist the vault is not simply a big room.",
  "Breaking: supply going down, morale going up.",
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
