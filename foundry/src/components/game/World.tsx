"use client";

import type { GameView } from "@/lib/types";
import { GENERATORS, GENERATOR_BY_ID } from "@/lib/content/generators";
import { GenIcon } from "@/components/ui/Icons";
import { fmt } from "@/lib/format";
import { SCENES } from "./scenes";

/** One scene per owned building type, with one unit sprite per building (capped). */
export function World({ server, onLevelUp, canAfford, frozen }: { server: GameView; onLevelUp: (id: string) => void; canAfford: (n: number) => boolean; frozen: boolean }) {
  const owned = server.generators.filter((g) => g.count > 0);
  if (owned.length === 0) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-2 p-8 text-center">
        <div className="font-display text-xl font-semibold text-slate-200">No operations yet</div>
        <p className="max-w-sm text-sm text-slate-400">Extract from the deposit to fund your first Cursor. Each operation you build appears here and adds to the community burn.</p>
      </div>
    );
  }
  return (
    <div>
      {GENERATORS.filter((d) => owned.some((o) => o.id === d.id)).map((def) => {
        const g = server.generators.find((x) => x.id === def.id)!;
        const shown = Math.min(g.count, 36);
        return (
          <section key={def.id} className="world-scene" style={{ backgroundImage: SCENES[def.category] }}>
            <header className="world-head">
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold uppercase tracking-wider text-slate-100">{def.name}</span>
                <span className="chip">×{g.count.toLocaleString("en-US")}</span>
                <span className="chip">level {g.level}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="num text-slate-200">{fmt(g.perSec)}/s</span>
                <span className="num text-ember">{fmt(g.burnPerSec)} burn/s</span>
                <button className="btn !px-2 !py-0.5 !text-[11px]" disabled={frozen || !canAfford(g.levelCost)} onClick={() => onLevelUp(def.id)} title={`+50% output for every ${def.name}`}>
                  Upgrade · {fmt(g.levelCost)}
                </button>
              </div>
            </header>
            <div className="world-units">
              {Array.from({ length: shown }, (_, i) => (
                <span key={i} className="world-unit" style={{ animationDelay: `${(i % 9) * 0.27}s` }}>
                  <GenIcon icon={GENERATOR_BY_ID[def.id].icon} className="h-6 w-6" />
                </span>
              ))}
              {g.count > shown && <span className="self-center text-[11px] text-slate-400">+{(g.count - shown).toLocaleString("en-US")} more</span>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
