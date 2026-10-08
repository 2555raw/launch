'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Crosshair, Droplets, Feather, Gauge, Heart, Lock, Sword, Tent, Timer } from 'lucide-react';
import type { TroopDefinition } from '@launch/game-engine';
import type { ArmyDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { TroopAvatar } from './troop-avatar';
import { fmtDuration } from '@/components/ui/dates';
import { Spinner, fmt } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

const MAX_PER_ORDER = 50;

export interface TroopCardProps {
  def: TroopDefinition;
  /** The player's level for this troop; undefined when the troop is still locked. */
  level: number | undefined;
  housingFree: number;
  elixir: number;
  /** Working barracks split the training time between them. */
  barracksCount: number;
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Heart; label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs" title={label}>
      <Icon size={12} className={tone ?? 'text-slate-500'} />
      <span className="text-slate-500">{label}</span>
      <span className="ml-auto font-mono text-slate-200">{value}</span>
    </div>
  );
}

export function TroopCard({ def, level, housingFree, elixir, barracksCount }: TroopCardProps) {
  const qc = useQueryClient();
  const locked = level === undefined;
  const lvl = def.levels[Math.max(0, (level ?? 1) - 1)] ?? def.levels[0];
  const maxByHousing = Math.floor(housingFree / def.housing);
  const [count, setCount] = useState(1);

  const cost = lvl.trainCost * count;
  const seconds = Math.ceil((def.trainTimeSec * count) / Math.max(1, barracksCount));
  const reason = useMemo(() => {
    if (locked) return `Requires Barracks level ${def.requiredBarracksLevel}`;
    if (count < 1 || count > MAX_PER_ORDER) return `Train 1–${MAX_PER_ORDER} at a time`;
    if (count * def.housing > housingFree) return maxByHousing <= 0 ? 'Army camps are full' : `Only room for ${maxByHousing}`;
    if (cost > elixir) return 'Not enough elixir';
    return null;
  }, [locked, def, count, housingFree, maxByHousing, cost, elixir]);

  const train = useMutation({
    mutationFn: () => api<{ army: ArmyDTO }>('/game/army/train', { method: 'POST', json: { troopType: def.type, count } }),
    onSuccess: (data) => {
      qc.setQueryData(['army'], data);
      void qc.invalidateQueries({ queryKey: ['village'] });
      toast.success('Training started', `${count}× ${def.name} queued.`);
    },
    onError: (e) => toast.error('Training failed', errorMessage(e)),
  });

  const setClamped = (n: number) => setCount(Math.max(1, Math.min(MAX_PER_ORDER, Number.isFinite(n) ? Math.floor(n) : 1)));

  return (
    <div className={`card flex flex-col p-4 ${locked ? 'opacity-80' : ''}`}>
      <div className="flex items-start gap-3">
        <TroopAvatar type={def.type} locked={locked} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold text-white">{def.name}</h3>
            {locked ? (
              <span className="badge gap-1 border-slate-500/30 text-slate-400">
                <Lock size={10} /> Barracks {def.requiredBarracksLevel}
              </span>
            ) : (
              <span className="badge border-ember-500/30 text-ember-300">Level {level}</span>
            )}
            {def.isFlying && <span className="badge gap-1 border-sky-500/30 text-sky-300"><Feather size={10} /> Flying</span>}
            {def.suicide && <span className="badge border-rose-500/30 text-rose-300">One use</span>}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{def.description}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <Stat icon={Heart} label="HP" value={fmt(lvl.hp)} tone="text-rose-400" />
        <Stat icon={Sword} label="Damage" value={`${fmt(lvl.damage)}${def.splashRadius ? ' splash' : ''}`} tone="text-ember-400" />
        <Stat icon={Gauge} label="Speed" value={`${def.moveSpeed} t/s`} tone="text-sky-400" />
        <Stat icon={Crosshair} label="Range" value={def.range <= 0.5 ? 'melee' : `${def.range} tiles`} tone="text-mint-400" />
        <Stat icon={Tent} label="Housing" value={String(def.housing)} />
        <Stat icon={Timer} label="Train time" value={fmtDuration(def.trainTimeSec)} />
        <Stat icon={Droplets} label="Cost" value={`${fmt(lvl.trainCost)} elixir`} tone="text-elixir-400" />
        <Stat icon={Crosshair} label="Targets" value={def.targetPreference === 'any' ? 'anything' : `${def.targetPreference}s`} />
      </div>

      {locked ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-slate-400">
          <Lock size={12} /> Requires Barracks level {def.requiredBarracksLevel}
        </div>
      ) : (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason) train.mutate();
          }}
        >
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => setClamped(count - 1)} disabled={count <= 1} aria-label="Fewer">
              −
            </button>
            <input className="input w-20 text-center font-mono" type="number" min={1} max={MAX_PER_ORDER} value={count} onChange={(e) => setClamped(Number(e.target.value))} />
            <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => setClamped(count + 1)} disabled={count >= MAX_PER_ORDER} aria-label="More">
              +
            </button>
            <button type="button" className="btn-ghost px-2 py-1.5 text-xs" onClick={() => setClamped(Math.min(MAX_PER_ORDER, Math.max(1, maxByHousing)))} disabled={maxByHousing <= 0} title="Fill the remaining camp space">
              Max
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Cost <span className={`font-mono ${cost > elixir ? 'text-rose-300' : 'text-elixir-400'}`}>{fmt(cost)}</span> elixir
            </span>
            <span>
              ≈ <span className="font-mono text-slate-200">{fmtDuration(seconds)}</span> · {count * def.housing} housing
            </span>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={!!reason || train.isPending} title={reason ?? undefined}>
            {train.isPending ? <Spinner /> : null}
            {reason ?? `Train ${count}× ${def.name}`}
          </button>
        </form>
      )}
    </div>
  );
}
