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

export function Shop({ server, balance, frozen, busy, onBuy, onUpgrade }: Props) {
  const [tab, setTab] = useState<"buildings" | "upgrades">("buildings");
  const [qty, setQty] = useState<1 | 10 | "max">(1);
  const available = server.availableUpgrades;
  return (
    <section className="panel flex h-full flex-col">
      <div className="panel-head !px-2">
        <div className="flex gap-1">
          <TabBtn active={tab === "buildings"} onClick={() => setTab("buildings")}>Buildings</TabBtn>
          <TabBtn active={tab === "upgrades"} onClick={() => setTab("upgrades")}>
            Upgrades {available.length > 0 && <span className="ml-1 rounded-full bg-brand/30 px-1.5 text-[10px] text-brand-soft">{available.length}</span>}
          </TabBtn>
        </div>
        {tab === "buildings" && (
          <div className="flex gap-1">
            {([1, 10, "max"] as const).map((q) => (
              <button key={q} className={`rounded px-2 py-0.5 text-[11px] ${qty === q ? "bg-brand/25 text-brand-soft" : "text-slate-500 hover:text-slate-300"}`} onClick={() => setQty(q)}>
                {q === "max" ? "MAX" : `×${q}`}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto">
        {tab === "buildings" ? (
          <ul>
            {GENERATORS.map((def, idx) => {
              const g = server.generators.find((x) => x.id === def.id)!;
              const prevUnlocked = idx === 0 || server.generators.find((x) => x.id === GENERATORS[idx - 1].id)!.unlocked;
              if (!g.unlocked && !prevUnlocked) return null;
              const cost = qty === 1 ? g.cost : qty === 10 ? g.cost10 : g.cost;
              const affordable = g.unlocked && balance >= cost;
              return (
                <li key={def.id} className={`border-b border-white/[0.05] ${g.unlocked ? "" : "opacity-50"}`}>
                  <button
                    className={`group flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${affordable && !frozen ? "hover:bg-white/[0.04]" : "cursor-not-allowed"}`}
                    disabled={!affordable || frozen || busy}
                    onClick={() => onBuy(def.id, qty)}
                    title={def.flavor}
                  >
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 ${affordable ? "bg-brand/10 text-brand-soft" : "bg-ink-800 text-slate-500"}`}>
                      <GenIcon icon={def.icon} className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-display text-base font-semibold text-slate-100">{g.unlocked ? def.name : "???"}</span>
                        <span className="num text-2xl font-bold leading-none text-slate-500 group-hover:text-slate-300">{g.count || ""}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2 text-xs">
                        <span className={`num font-semibold ${affordable ? "text-emerald-300" : "text-red-300/80"}`}>{g.unlocked ? fmt(cost) : `unlock at ${fmt(def.unlockAt)}`}</span>
                        <span className="num text-slate-400">+{fmt(g.eachPerSec)}/s each</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul>
            {UPGRADES.filter((u) => !server.upgrades.includes(u.id))
              .sort((a, b) => Number(available.includes(b.id)) - Number(available.includes(a.id)) || a.cost - b.cost)
              .map((u) => {
                const unlocked = available.includes(u.id);
                const affordable = unlocked && balance >= u.cost;
                return (
                  <li key={u.id} className={`border-b border-white/[0.05] ${unlocked ? "" : "opacity-45"}`}>
                    <button
                      className={`flex w-full flex-col gap-1 px-3 py-2.5 text-left ${affordable && !frozen ? "hover:bg-white/[0.04]" : "cursor-not-allowed"}`}
                      disabled={!affordable || frozen || busy}
                      onClick={() => onUpgrade(u.id)}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-base font-semibold text-slate-100">{u.name}</span>
                        <span className={`num text-xs font-semibold ${affordable ? "text-emerald-300" : "text-red-300/80"}`}>{fmt(u.cost)}</span>
                      </span>
                      <span className="text-xs text-slate-400">{u.description}</span>
                      {!unlocked && <span className="text-[11px] text-slate-500">requires {describeRequirement(u.requires)}</span>}
                    </button>
                  </li>
                );
              })}
            {server.upgrades.length > 0 && (
              <li className="px-3 py-3 text-xs text-slate-500">
                Owned: {server.upgrades.map((id) => UPGRADE_BY_ID[id]?.name ?? id).join(", ")}
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded px-2.5 py-1 font-display text-xs font-semibold uppercase tracking-[0.15em] ${active ? "bg-white/[0.07] text-slate-100" : "text-slate-500 hover:text-slate-300"}`}>
      {children}
    </button>
  );
}
