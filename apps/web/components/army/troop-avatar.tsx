'use client';
import clsx from 'clsx';
import { Lock } from 'lucide-react';
import { TROOP_DEFINITIONS } from '@launch/game-engine';

/** Deterministic gradient per troop type (falls back to a hash of the type for unknown troops). */
const PALETTE: Record<string, string> = {
  grunt: 'from-ember-400 to-ember-700',
  ranger: 'from-mint-400 to-emerald-800',
  brute: 'from-amber-400 to-orange-800',
  breacher: 'from-rose-400 to-rose-800',
  sky_scout: 'from-sky-400 to-indigo-700',
  pyromancer: 'from-elixir-400 to-elixir-600',
};
const FALLBACK = ['from-slate-400 to-slate-700', 'from-cyan-400 to-cyan-800', 'from-lime-400 to-lime-800', 'from-fuchsia-400 to-fuchsia-800'];

export function troopGradient(type: string): string {
  if (PALETTE[type]) return PALETTE[type];
  let h = 0;
  for (const c of type) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}

export function troopName(type: string): string {
  return TROOP_DEFINITIONS[type]?.name ?? type.replace(/_/g, ' ');
}

export function TroopAvatar({ type, size = 'md', locked, className }: { type: string; size?: 'sm' | 'md' | 'lg'; locked?: boolean; className?: string }) {
  const name = troopName(type);
  const dim = size === 'sm' ? 'h-8 w-8 text-sm' : size === 'lg' ? 'h-16 w-16 text-2xl' : 'h-11 w-11 text-lg';
  return (
    <div className={clsx('relative grid shrink-0 place-items-center rounded-xl bg-gradient-to-br font-display font-extrabold text-ink-950 shadow-card', dim, troopGradient(type), locked && 'opacity-40 grayscale', className)} title={name} aria-label={name}>
      {name.slice(0, 1).toUpperCase()}
      {locked && (
        <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-ink-800 text-slate-300 ring-1 ring-white/10">
          <Lock size={11} />
        </span>
      )}
    </div>
  );
}
