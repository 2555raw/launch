"use client";

import type { GameView } from "@/lib/types";
import { GENERATORS, GENERATOR_BY_ID, type GeneratorCategory } from "@/lib/content/generators";
import { GenIcon } from "@/components/ui/Icons";
import { fmt } from "@/lib/format";

const BANDS: Record<GeneratorCategory, string> = {
  cursor: "from-sky-900/40 via-ink-800 to-ink-900",
  extraction: "from-amber-900/40 via-ink-800 to-ink-900",
  industry: "from-orange-900/40 via-ink-800 to-ink-900",
  finance: "from-emerald-900/40 via-ink-800 to-ink-900",
  mega: "from-fuchsia-900/40 via-ink-800 to-ink-900",
};

/** One band per owned generator type, with as many icons as you own (capped). */
export function World({ server, onLevelUp, canAfford, frozen }: { server: GameView; onLevelUp: (id: string) => void; canAfford: (n: number) => boolean; frozen: boolean }) {
  const owned = server.generators.filter((g) => g.count > 0);
  if (owned.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 p-8 text-center">
        <div className="font-display text-xl font-semibold text-slate-300">Your empire is an empty lot.</div>
        <p className="max-w-sm text-sm text-slate-500">Click the deposit to earn your first units, then buy a Cursor from the shop. Everything you build here adds to the community burn.</p>
      </div>
    );
  }
  return (
    <div className="scroll-thin max-h-[560px] overflow-y-auto">
      {GENERATORS.filter((d) => owned.some((o) => o.id === d.id)).map((def) => {
        const g = server.generators.find((x) => x.id === def.id)!;
        const shown = Math.min(g.count, 40);
        return (
          <div key={def.id} className={`world-row bg-gradient-to-r ${BANDS[def.category]}`}>
            <div className="flex items-center justify-between px-4 pt-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-semibold uppercase tracking-wider text-slate-200">{def.name}</span>
                <span className="chip">×{g.count.toLocaleString("en-US")}</span>
                <span className="chip">lvl {g.level}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="num text-slate-300">{fmt(g.perSec)}/s</span>
                <span className="num text-ember">{fmt(g.burnPerSec)} burn/s</span>
                <button
                  className="btn !px-2 !py-0.5 !text-[11px]"
                  disabled={frozen || !canAfford(g.levelCost)}
                  onClick={() => onLevelUp(def.id)}
                  title={`Level up: +50% output for ${def.name}`}
                >
                  Level up · {fmt(g.levelCost)}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 px-4 pb-4 pt-2 text-brand-soft/80">
              {Array.from({ length: shown }, (_, i) => (
                <span key={i} className="world-icon" style={{ animationDelay: `${(i % 9) * 0.27}s` }}>
                  <GenIcon icon={GENERATOR_BY_ID[def.id].icon} className="h-5 w-5" />
                </span>
              ))}
              {g.count > shown && <span className="self-center text-[11px] text-slate-500">+{(g.count - shown).toLocaleString("en-US")} more</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
