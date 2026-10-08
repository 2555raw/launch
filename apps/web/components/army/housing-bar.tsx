'use client';
import { Tent } from 'lucide-react';
import { TROOP_DEFINITIONS } from '@launch/game-engine';
import type { ArmyDTO } from '@launch/types';
import { fmt } from '@/components/ui/primitives';

function housingOf(type: string): number {
  return TROOP_DEFINITIONS[type]?.housing ?? 1;
}

export function HousingBar({ army }: { army: ArmyDTO }) {
  const ready = army.units.reduce((n, u) => n + u.count * housingOf(u.troopType), 0);
  const training = army.training.reduce((n, j) => n + j.count * housingOf(j.troopType), 0);
  const cap = army.housingCapacity;
  const pct = (n: number) => (cap > 0 ? Math.min(100, (n / cap) * 100) : 0);
  const full = army.housingUsed >= cap;
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-display text-sm font-semibold text-white">
          <Tent size={16} className="text-ember-400" /> Army camps
        </div>
        <div className="font-mono text-sm">
          <span className={full ? 'text-ember-300' : 'text-white'}>{fmt(army.housingUsed)}</span>
          <span className="text-slate-500"> / {fmt(cap)} housing</span>
        </div>
      </div>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full bg-gradient-to-r from-ember-600 to-ember-400 transition-[width] duration-500" style={{ width: `${pct(ready)}%` }} title={`Ready: ${ready}`} />
        <div className="h-full bg-gradient-to-r from-elixir-600 to-elixir-400 transition-[width] duration-500" style={{ width: `${pct(training)}%` }} title={`In training: ${training}`} />
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-ember-400" /> Ready {fmt(ready)}</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-elixir-400" /> In training {fmt(training)}</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-white/20" /> Free {fmt(Math.max(0, cap - army.housingUsed))}</span>
        {cap === 0 && <span className="text-ember-300">Build an Army Camp to house troops.</span>}
      </div>
    </div>
  );
}
