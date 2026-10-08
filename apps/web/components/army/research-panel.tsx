'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Timer } from 'lucide-react';
import type { TroopDefinition } from '@launch/game-engine';
import type { ArmyDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useNow } from '@/lib/hooks';
import { TroopAvatar, troopName } from './troop-avatar';
import { fmtDuration } from '@/components/ui/dates';
import { Spinner, fmt, timeLeft } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

export function ResearchPanel({ army, troops, labLevel, elixir }: { army: ArmyDTO; troops: TroopDefinition[]; labLevel: number; elixir: number }) {
  const now = useNow(1000);
  const qc = useQueryClient();
  const research = useMutation({
    mutationFn: (troopType: string) => api<{ army: ArmyDTO }>('/game/army/research', { method: 'POST', json: { troopType } }),
    onSuccess: (data, troopType) => {
      qc.setQueryData(['army'], data);
      void qc.invalidateQueries({ queryKey: ['village'] });
      toast.success('Research started', `${troopName(troopType)} is being upgraded in the Laboratory.`);
    },
    onError: (e) => toast.error('Research failed', errorMessage(e)),
  });

  const unlocked = troops.filter((t) => army.troopLevels[t.type] !== undefined);
  const busy = army.research !== null;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-sm font-semibold text-white">
          <FlaskConical size={16} className="text-mint-400" /> Laboratory
        </div>
        <span className="badge">{labLevel > 0 ? `Level ${labLevel}` : 'Not built'}</span>
      </div>

      {army.research ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-mint-500/30 bg-mint-500/5 p-3">
          <TroopAvatar type={army.research.troopType} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-100">Upgrading {troopName(army.research.troopType)}</div>
            <div className="text-xs text-slate-400">to level {(army.troopLevels[army.research.troopType] ?? 1) + 1}</div>
          </div>
          <div className="flex items-center gap-1 font-mono text-sm text-mint-400">
            <Timer size={14} /> {timeLeft(army.research.completesAt, now)}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">{labLevel > 0 ? 'The Laboratory is idle. Pick a troop to upgrade.' : 'Build a Laboratory (Town Hall 3) to research troop upgrades.'}</p>
      )}

      <ul className="mt-3 space-y-2">
        {unlocked.map((def) => {
          const level = army.troopLevels[def.type] ?? 1;
          const next = def.levels[level];
          let reason: string | null = null;
          if (!next) reason = 'Max level';
          else if (labLevel <= 0) reason = 'Build a Laboratory first';
          else if (busy) reason = 'Laboratory busy';
          else if (next.requiredLabLevel > labLevel) reason = `Requires Laboratory level ${next.requiredLabLevel}`;
          else if (next.researchCost > elixir) reason = 'Not enough elixir';
          const pending = research.isPending && research.variables === def.type;
          return (
            <li key={def.type} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-3">
                <TroopAvatar type={def.type} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-100">{def.name}</span>
                    <span className="text-xs text-slate-500">
                      lvl {level}
                      {next ? ` → ${next.level}` : ' (max)'}
                    </span>
                  </div>
                  {next && (
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                      <span>
                        <span className={`font-mono ${next.researchCost > elixir ? 'text-rose-300' : 'text-elixir-400'}`}>{fmt(next.researchCost)}</span> elixir
                      </span>
                      <span className="font-mono">{fmtDuration(next.researchTimeSec)}</span>
                      <span>Lab {next.requiredLabLevel}</span>
                      <span className="text-slate-500">
                        +{next.hp - def.levels[level - 1].hp} hp · +{next.damage - def.levels[level - 1].damage} dmg
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {next && (
                <button className="btn-secondary mt-2 w-full py-1.5 text-xs" disabled={!!reason || research.isPending} onClick={() => research.mutate(def.type)} title={reason ?? undefined}>
                  {pending ? <Spinner /> : null}
                  {reason ?? `Research level ${next.level}`}
                </button>
              )}
            </li>
          );
        })}
        {unlocked.length === 0 && <li className="text-xs text-slate-500">No troops unlocked yet.</li>}
      </ul>
    </div>
  );
}
