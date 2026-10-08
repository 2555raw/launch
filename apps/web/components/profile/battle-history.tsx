'use client';
import Link from 'next/link';
import { ArrowRight, Shield, Star, Swords } from 'lucide-react';
import { ago, signed } from '@/components/ui/dates';
import { compact } from '@/components/ui/primitives';

/** Shape of packages/game-core battle.service battleHistory(). */
export interface BattleHistoryItem {
  id: string;
  role: 'attack' | 'defense';
  opponent: { id: string; name: string };
  stars: number;
  destructionPercent: number;
  lootGold: number;
  lootElixir: number;
  trophyDelta: number;
  endedAt: string | null;
}

export function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} stars`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} size={size} className={i < n ? 'fill-gold-400 text-gold-400' : 'text-slate-700'} />
      ))}
    </span>
  );
}

export function BattleHistory({ battles, title = 'Battle log' }: { battles: BattleHistoryItem[]; title?: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-sm font-semibold text-white">
          <Swords size={16} className="text-ember-400" /> {title}
        </div>
        <span className="badge">{battles.length}</span>
      </div>
      {battles.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No battles yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/[0.05]">
          {battles.map((b) => {
            const attack = b.role === 'attack';
            // From this player's point of view: an attack is won with ≥1 star; a defense is held when the attacker got 0 stars.
            const won = attack ? b.stars >= 1 : b.stars === 0;
            return (
              <li key={b.id}>
                <Link href={`/battles/${b.id}`} className="flex flex-wrap items-center gap-3 py-2.5 transition hover:bg-white/[0.02]">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${attack ? 'bg-ember-500/15 text-ember-300' : 'bg-elixir-500/15 text-elixir-400'}`}>{attack ? <Swords size={16} /> : <Shield size={16} />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-slate-400">{attack ? 'Attacked' : 'Defended against'}</span>
                      <span className="font-semibold text-slate-100">{b.opponent.name}</span>
                      <span className={`badge ${won ? 'border-mint-500/30 text-mint-400' : 'border-rose-500/30 text-rose-300'}`}>{won ? (attack ? 'Victory' : 'Held') : attack ? 'Defeat' : 'Raided'}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                      <Stars n={b.stars} />
                      <span>{b.destructionPercent}% destroyed</span>
                      <span className="text-gold-300">{compact(b.lootGold)} gold</span>
                      <span className="text-elixir-400">{compact(b.lootElixir)} elixir</span>
                      <span>{ago(b.endedAt)}</span>
                    </div>
                  </div>
                  <span className={`font-mono text-sm font-semibold ${b.trophyDelta >= 0 ? 'text-mint-400' : 'text-rose-300'}`}>{signed(b.trophyDelta)}</span>
                  <ArrowRight size={14} className="text-slate-600" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
