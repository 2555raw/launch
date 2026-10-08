"use client";

import { useState } from "react";
import type { GameView } from "@/lib/types";
import { GENERATORS } from "@/lib/content/generators";
import { UPGRADES, UPGRADE_BY_ID } from "@/lib/content/upgrades";
import { describeRequirement, generatorBulkCost } from "@/lib/economy";
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
  const [qty, setQty] = useState<1 | 10 | 100>(1);
  const available = server.availableUpgrades;
  const upgrades = UPGRADES.filter((u) => available.includes(u.id)).sort((a, b) => a.cost - b.cost);
  const owned = server.upgrades.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="store-head">STORE</div>

      {/* upgrades */}
      <div className="border-b-2 border-[#0b0f15] px-3 py-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="serif text-sm font-bold text-white/90">Upgrades</span>
          <span className="text-[11px] text-white/60">{owned} owned</span>
        </div>
        {upgrades.length === 0 ? (
          <div className="text-xs text-white/60">
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
      <div className="cc-buyrow">
        <span>Buy</span>
        {([1, 10, 100] as const).map((q) => (
          <button key={q} onClick={() => setQty(q)} className={qty === q ? "on" : ""}>{q}</button>
        ))}
      </div>

      {/* buildings */}
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {GENERATORS.map((def, idx) => {
          const g = server.generators.find((x) => x.id === def.id)!;
          const prevUnlocked = idx === 0 || server.generators.find((x) => x.id === GENERATORS[idx - 1].id)!.unlocked;
          if (!g.unlocked && !prevUnlocked) return null;
          const cost = qty === 1 ? g.cost : qty === 10 ? g.cost10 : generatorBulkCost(def, g.count, 100);
          const affordable = g.unlocked && balance >= cost && !frozen;
          return (
            <button
              key={def.id}
              className={`store-row ${!g.unlocked ? "locked" : affordable ? "ok" : "poor"}`}
              disabled={!affordable || busy}
              onClick={() => onBuy(def.id, qty)}
              title={g.unlocked ? `${def.flavor}\n+${fmt(g.eachPerSec)}/s each · ${fmt(g.perSec)}/s total · level ${g.level}` : `Unlocks at ${fmt(def.unlockAt)} total production`}
            >
              <span className="store-icon shrink-0">
                <GenIcon icon={def.icon} className="h-8 w-8" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="store-name block truncate leading-tight">{g.unlocked ? def.name : "???"}</span>
                <span className={`store-cost ${affordable || !g.unlocked ? "" : "poor"}`}>◉ {fmt(cost)}</span>
                {g.unlocked && <span className="ml-2 text-[11px] text-slate-300/70">+{fmt(g.eachPerSec)}/s</span>}
              </span>
              <span className="store-owned">{g.count || ""}</span>
            </button>
          );
        })}
        {server.upgrades.length > 0 && (
          <div className="px-3 py-2 text-[11px] text-white/50">Researched: {server.upgrades.map((id) => UPGRADE_BY_ID[id]?.name ?? id).join(", ")}</div>
        )}
      </div>
    </div>
  );
}

function abbr(name: string): string {
  const words = name.split(/\s+/);
  return words.length > 1 ? words.map((w) => w[0]).join("").slice(0, 3).toUpperCase() : name.slice(0, 3).toUpperCase();
}
