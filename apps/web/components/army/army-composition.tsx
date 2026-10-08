'use client';
import { Swords } from 'lucide-react';
import { TROOP_DEFINITIONS } from '@launch/game-engine';
import type { ArmyDTO } from '@launch/types';
import { TroopAvatar, troopName } from './troop-avatar';
import { fmt } from '@/components/ui/primitives';

export function ArmyComposition({ army }: { army: ArmyDTO }) {
  const total = army.units.reduce((n, u) => n + u.count, 0);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-sm font-semibold text-white">
          <Swords size={16} className="text-ember-400" /> Your army
        </div>
        <span className="badge">{fmt(total)} units</span>
      </div>
      {army.units.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No troops ready. Train some below and they will gather here.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {army.units.map((u) => {
            const def = TROOP_DEFINITIONS[u.troopType];
            return (
              <li key={u.troopType} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2">
                <TroopAvatar type={u.troopType} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-100">{troopName(u.troopType)}</div>
                  <div className="text-xs text-slate-400">
                    <span className="font-mono text-white">×{u.count}</span> · lvl {u.level}
                    {def && <span className="text-slate-600"> · {u.count * def.housing} housing</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
