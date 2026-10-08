"use client";

import { useState } from "react";
import type { GameView } from "@/lib/types";
import { GENERATORS } from "@/lib/content/generators";
import { UPGRADES, UPGRADE_BY_ID } from "@/lib/content/upgrades";
import { describeRequirement } from "@/lib/economy";
import { GenIcon } from "@/components/ui/Icons";
import { fmt } from "@/lib/format";

interface Props {
  server: GameView;
  balance: number;
  frozen: boolean;
  busy: boolean;
  onBuy: (id: string, qty: number | "max") => void;
  onUpgrade: (id: string) => void;
}

/** Right column: upgrades as a tile grid, then the building list. */
export function Store({ server, balance, frozen, busy, onBuy, onUpgrade }: Props) {
  const [qty, setQty] = useState<1 | 10 | "max">(1);
  const available = server.availableUpgrades;
  const upgrades = UPGRADES.filter((u) => available.includes(u.id)).sort((a, b) => a.cost - b.cost);
  const owned = server.upgrades.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="store-head">STORE</div>

      {/* upgrades */}
      <div className="border-b-2 border-[#0b0f15] px-3 py-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label">Upgrades</span>
          <span className="text-[11px] text-slate-500">{owned} owned</span>
        </div>
        {upgrades.length === 0 ? (
          <div className="text-xs text-slate-500">
            {server.upgrades.length === UPGRADES.length ? "Everything researched." : `Next: ${describeRequirement(UPGRADES.filter((u) => !server.upgrades.includes(u.id)).sort((a, b) => a.tier - b.tier)[0]?.requires ?? { type: "clicks", value: 0 })}`}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {upgrades.map((u) => {
              const ok = balance >= u.cost && !frozen;
              return (
                <button
                  key={u.id}
                  className={`upgrade-tile ${ok ? "ok" : "poor"}`}
                  disabled={!ok || busy}
                  onClick={() => onUpgrade(u.id)}
                  title={`${u.name} — ${u.description}\nCost: ${fmt(u.cost)}`}
                >
                  {abbr(u.name)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* buy mode */}
      <div className="flex items-center gap-2 border-b-2 border-[#0b0f15] bg-[#0b0f15] px-3 py-1.5">
        <span className="font-display text-xs font-bold uppercase tracking-widest text-slate-400">Buy</span>
        {([1, 10, "max"] as const).map((q) => (
          <button key={q} onClick={() => setQty(q)} className={`rounded px-2.5 py-0.5 font-display text-sm font-bold ${qty === q ? "bg-brand/25 text-brand-soft" : "text-slate-500 hover:text-slate-200"}`}>
            {q === "max" ? "MAX" : q}
          </button>
        ))}
      </div>

      {/* buildings */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {GENERATORS.map((def, idx) => {
          const g = server.generators.find((x) => x.id === def.id)!;
          const prevUnlocked = idx === 0 || server.generators.find((x) => x.id === GENERATORS[idx - 1].id)!.unlocked;
          if (!g.unlocked && !prevUnlocked) return null;
          const cost = qty === 10 ? g.cost10 : g.cost;
          const affordable = g.unlocked && balance >= cost && !frozen;
          return (
            <button
              key={def.id}
              className={`store-row ${!g.unlocked ? "locked" : affordable ? "ok" : "poor"}`}
              disabled={!affordable || busy}
              onClick={() => onBuy(def.id, qty)}
              title={g.unlocked ? `${def.flavor}\n+${fmt(g.eachPerSec)}/s each · ${fmt(g.perSec)}/s total · level ${g.level}` : `Unlocks at ${fmt(def.unlockAt)} total production`}
            >
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-md border border-white/10 ${g.unlocked ? "bg-brand/10 text-brand-soft" : "bg-ink-800 text-slate-500"}`}>
                <GenIcon icon={def.icon} className="h-7 w-7" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-lg font-bold leading-tight text-slate-100">{g.unlocked ? def.name : "???"}</span>
                <span className={`num text-sm font-semibold ${affordable ? "text-emerald-300" : "text-red-300/80"}`}>{fmt(cost)}</span>
                {g.unlocked && <span className="ml-2 text-[11px] text-slate-500">+{fmt(g.eachPerSec)}/s</span>}
              </span>
              <span className="num text-3xl font-bold leading-none text-slate-500">{g.count || ""}</span>
            </button>
          );
        })}
        {server.upgrades.length > 0 && (
          <div className="px-3 py-2 text-[11px] text-slate-600">Researched: {server.upgrades.map((id) => UPGRADE_BY_ID[id]?.name ?? id).join(", ")}</div>
        )}
      </div>
    </div>
  );
}

function abbr(name: string): string {
  const words = name.split(/\s+/);
  return words.length > 1 ? words.map((w) => w[0]).join("").slice(0, 3).toUpperCase() : name.slice(0, 3).toUpperCase();
}
