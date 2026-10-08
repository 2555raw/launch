'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Clock, Shield, ShieldAlert, Swords } from 'lucide-react';
import type { BattleEvent, BattleResultDTO, BattleSnapshot, BattleState, DeploymentRecord } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useRequireAuth } from '@/lib/hooks';
import { TroopAvatar, troopName } from '@/components/army/troop-avatar';
import { Stars } from '@/components/profile/battle-history';
import { fmtDate, fmtDuration, signed } from '@/components/ui/dates';
import { Empty, PageHeader, Spinner, Stat, fmt } from '@/components/ui/primitives';
import { Table, Td, Th, Tr } from '@/components/ui/table';

interface BattleDetail {
  id: string;
  state: BattleState;
  attacker: { id: string; name: string };
  defender: { id: string; name: string };
  seed: number;
  snapshot: BattleSnapshot;
  army: Record<string, number>;
  deployments: DeploymentRecord[];
  result: BattleResultDTO | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
}
interface Replay {
  recorded: BattleResultDTO | null;
  replayed: { stars: number; destructionPercent: number; lootGold: number; lootElixir: number };
  matches: boolean;
  events: BattleEvent[];
}

const STATE_STYLE: Record<BattleState, string> = { FINISHED: 'border-mint-500/30 text-mint-400', ACTIVE: 'border-ember-500/30 text-ember-300', PENDING: 'text-slate-400', ABANDONED: 'border-rose-500/30 text-rose-300' };

function describeEvent(e: BattleEvent): string {
  switch (e.kind) {
    case 'deploy':
      return `${troopName(e.troopType)} deployed at (${e.x}, ${e.y})`;
    case 'building_destroyed':
      return `${e.buildingType.replace(/_/g, ' ')} destroyed`;
    case 'troop_died':
      return `Troop #${e.entityId} fell`;
    case 'star':
      return `Star ${e.stars} earned`;
    case 'rejected':
      return `Deployment rejected: ${e.reason}`;
  }
}

export default function BattlePage() {
  const user = useRequireAuth({ player: true });
  const { id } = useParams<{ id: string }>();
  const [showAll, setShowAll] = useState(false);
  const battle = useQuery({ queryKey: ['battle', id], queryFn: () => api<{ battle: BattleDetail }>(`/game/battles/${id}`), enabled: !!user?.playerId && !!id });
  const finished = battle.data?.battle.state === 'FINISHED';
  const replay = useQuery({ queryKey: ['battle', id, 'replay'], queryFn: () => api<Replay>(`/game/battles/${id}/replay`), enabled: !!user?.playerId && finished });

  if (!user) return null;
  if (battle.error) return <Empty title="Battle not found" body={errorMessage(battle.error)} action={<Link href="/profile" className="btn-secondary">Back to profile</Link>} />;
  if (!battle.data) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-slate-400">
        <Spinner /> Loading battle…
      </div>
    );
  }
  const b = battle.data.battle;
  const r = b.result;
  const iAmAttacker = b.attacker.id === user.playerId;
  const deployments = showAll ? b.deployments : b.deployments.slice(0, 25);
  const troopsUsed = r?.troopsUsed && Object.keys(r.troopsUsed).length ? r.troopsUsed : b.army;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/profile" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
        <ArrowLeft size={14} /> Back to battle log
      </Link>
      <PageHeader
        title={`${b.attacker.name} vs ${b.defender.name}`}
        subtitle={`${fmtDate(b.endedAt ?? b.startedAt ?? b.createdAt)} · seed ${b.seed}`}
        actions={<span className={`badge ${STATE_STYLE[b.state]}`}>{b.state.toLowerCase()}</span>}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={`/players/${b.attacker.id}`} className={`card flex items-center gap-3 p-4 transition hover:border-ember-500/40 ${iAmAttacker ? 'ring-1 ring-ember-500/40' : ''}`}>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-ember-500/15 text-ember-300"><Swords size={20} /></span>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Attacker{iAmAttacker ? ' · you' : ''}</div>
            <div className="font-display text-lg font-bold text-white">{b.attacker.name}</div>
          </div>
        </Link>
        <Link href={`/players/${b.defender.id}`} className={`card flex items-center gap-3 p-4 transition hover:border-elixir-500/40 ${!iAmAttacker ? 'ring-1 ring-elixir-500/40' : ''}`}>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-elixir-500/15 text-elixir-400"><Shield size={20} /></span>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Defender{!iAmAttacker ? ' · you' : ''} · Town Hall {b.snapshot.townHallLevel}</div>
            <div className="font-display text-lg font-bold text-white">{b.defender.name}</div>
          </div>
        </Link>
      </div>

      {r ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Result" value={<span className="flex items-center gap-2"><Stars n={r.stars} size={16} /> {r.victory ? 'Victory' : 'Defeat'}</span>} hint={`${r.destructionPercent}% destruction`} accent={r.victory ? 'mint' : 'ember'} />
          <Stat label="Loot" value={<span className="text-gold-300">{fmt(r.lootGold)} <span className="text-xs text-slate-500">gold</span></span>} hint={`${fmt(r.lootElixir)} elixir`} />
          <Stat label="Trophies" value={<span className={r.attackerTrophyDelta >= 0 ? 'text-mint-400' : 'text-rose-300'}>{signed(r.attackerTrophyDelta)} <span className="text-xs text-slate-500">attacker</span></span>} hint={`${signed(r.defenderTrophyDelta)} defender`} />
          <Stat label="Duration" value={<span className="flex items-center gap-1.5"><Clock size={16} /> {fmtDuration(r.durationMs / 1000)}</span>} hint={`+${r.xpGained} xp for the attacker`} />
        </div>
      ) : (
        <div className="card p-4 text-sm text-slate-400">This battle has no result yet{b.state === 'ABANDONED' ? ': it was abandoned before troops were deployed.' : '.'}</div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-display text-sm font-semibold text-white">Army brought</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {Object.entries(troopsUsed).map(([type, count]) => (
              <li key={type} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 py-1.5 text-sm">
                <TroopAvatar type={type} size="sm" /> {troopName(type)} <span className="font-mono text-slate-400">×{count}</span>
              </li>
            ))}
            {Object.keys(troopsUsed).length === 0 && <li className="text-xs text-slate-500">No troops recorded.</li>}
          </ul>
        </div>

        <div className="card p-4">
          <h2 className="font-display text-sm font-semibold text-white">Server replay check</h2>
          {!finished ? (
            <p className="mt-2 text-xs text-slate-500">Available once the battle has finished.</p>
          ) : replay.isLoading ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400"><Spinner /> Re-simulating from seed and deployment log…</div>
          ) : replay.error ? (
            <p className="mt-2 text-xs text-rose-300">{errorMessage(replay.error)}</p>
          ) : replay.data ? (
            <div className="mt-2">
              <span className={`badge gap-1 ${replay.data.matches ? 'border-mint-500/40 text-mint-400' : 'border-rose-500/40 text-rose-300'}`}>
                {replay.data.matches ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
                {replay.data.matches ? 'matches ✓' : 'mismatch'}
              </span>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="text-slate-500">&nbsp;</div>
                <div className="text-slate-500">Recorded</div>
                <div className="text-slate-500">Replayed</div>
                {(
                  [
                    ['Stars', r?.stars, replay.data.replayed.stars],
                    ['Destruction', r ? `${r.destructionPercent}%` : undefined, `${replay.data.replayed.destructionPercent}%`],
                    ['Gold', r ? fmt(r.lootGold) : undefined, fmt(replay.data.replayed.lootGold)],
                    ['Elixir', r ? fmt(r.lootElixir) : undefined, fmt(replay.data.replayed.lootElixir)],
                  ] as const
                ).map(([label, a, c]) => (
                  <div key={label} className="contents">
                    <div className="text-slate-400">{label}</div>
                    <div className="font-mono text-slate-200">{a ?? '—'}</div>
                    <div className={`font-mono ${String(a) === String(c) ? 'text-slate-200' : 'text-rose-300'}`}>{c}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-white">Deployment log</h2>
          <span className="badge">{b.deployments.length} deployments</span>
        </div>
        {b.deployments.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No troops were deployed.</p>
        ) : (
          <>
            <Table className="mt-3">
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Time</Th>
                  <Th>Troop</Th>
                  <Th className="text-right">X</Th>
                  <Th className="text-right">Y</Th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((d, i) => (
                  <Tr key={i}>
                    <Td className="font-mono text-slate-500">{i + 1}</Td>
                    <Td className="font-mono">{(d.t / 1000).toFixed(1)}s</Td>
                    <Td className="flex items-center gap-2"><TroopAvatar type={d.troopType} size="sm" /> {troopName(d.troopType)}</Td>
                    <Td className="text-right font-mono">{d.x}</Td>
                    <Td className="text-right font-mono">{d.y}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            {b.deployments.length > 25 && (
              <button className="btn-ghost mt-2 text-xs" onClick={() => setShowAll((s) => !s)}>
                {showAll ? 'Show fewer' : `Show all ${b.deployments.length}`}
              </button>
            )}
          </>
        )}
      </div>

      {replay.data && replay.data.events.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-white">Replay events</h2>
            <span className="badge">first {Math.min(60, replay.data.events.length)} of {replay.data.events.length}</span>
          </div>
          <ol className="scroll-thin mt-3 max-h-72 space-y-1 overflow-y-auto text-xs">
            {replay.data.events.slice(0, 60).map((e, i) => (
              <li key={i} className={`flex gap-2 rounded-lg px-2 py-1 ${e.kind === 'star' ? 'bg-gold-500/10 text-gold-300' : e.kind === 'building_destroyed' ? 'text-ember-300' : e.kind === 'troop_died' ? 'text-slate-500' : e.kind === 'rejected' ? 'text-rose-300' : 'text-slate-300'}`}>
                <span className="w-6 shrink-0 font-mono text-slate-600">{i + 1}</span>
                {describeEvent(e)}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
