"use client";

import { ACHIEVEMENTS } from "@/lib/content/achievements";

export function AchievementsPanel({ unlocked }: { unlocked: string[] }) {
  const have = new Set(unlocked);
  return (
    <div className="p-3">
      <div className="mb-2 text-xs text-slate-500">{have.size} / {ACHIEVEMENTS.length} unlocked</div>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {ACHIEVEMENTS.map((a) => {
          const on = have.has(a.id);
          return (
            <li key={a.id} className={`rounded-md border px-3 py-2 ${on ? "border-brand/30 bg-brand/5" : "border-white/[0.05] opacity-50"}`}>
              <div className={`font-display text-sm font-semibold ${on ? "text-brand-soft" : "text-slate-300"}`}>{a.name}</div>
              <div className="text-xs text-slate-400">{a.description}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
