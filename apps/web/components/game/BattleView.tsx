'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BUILDING_DEFINITIONS, TROOP_DEFINITIONS, deploymentMask } from '@launch/game-engine';
import type { BattleResultDTO, BattleSnapshot, BattleStateDTO, ServerMessage } from '@launch/types';
import { Coins, Flame, Search, Star, Swords, Trophy, X } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { toast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/primitives';
import { IsoCanvas, type Camera } from './IsoCanvas';
import { drawBuilding, drawGround, drawTroop } from './sprites';

interface Match {
  battleId: string;
  seed: number;
  snapshot: BattleSnapshot;
  army: Record<string, number>;
  defender: { id: string; name: string; trophies: number; level: number; townHallLevel: number; clanName: string | null };
}

type Phase = { kind: 'idle' } | { kind: 'searching' } | { kind: 'preview'; match: Match } | { kind: 'joining'; match: Match } | { kind: 'battle'; match: Match } | { kind: 'result'; match: Match; result: BattleResultDTO };

export function BattleView() {
  const socket = useSocket();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [state, setState] = useState<BattleStateDTO | null>(null);
  const [army, setArmy] = useState<Record<string, number>>({});
  const [selectedTroop, setSelectedTroop] = useState<string | null>(null);
  const [prepUntil, setPrepUntil] = useState<number>(0);
  const [rev, setRev] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const match = phase.kind === 'idle' || phase.kind === 'searching' ? null : phase.match;
  const mask = useMemo(() => (match ? deploymentMask(match.snapshot.buildings, match.snapshot.gridSize) : null), [match]);

  useEffect(() => {
    return socket.subscribe((msg: ServerMessage) => {
      const p = phaseRef.current;
      if (msg.type === 'battle:ready' && (p.kind === 'joining' || p.kind === 'battle')) {
        setArmy(msg.army);
        setPrepUntil(Date.now() + msg.prepMs);
        setPhase({ kind: 'battle', match: p.match });
        setLog((l) => [`Battle ready. Deploy troops outside the red zone. ${Math.round(msg.prepMs / 1000)}s to plan.`, ...l]);
      } else if (msg.type === 'battle:state' && p.kind === 'battle') {
        setState(msg.state);
        setArmy(msg.state.remainingArmy);
        setRev((r) => r + 1);
      } else if (msg.type === 'battle:event' && p.kind === 'battle') {
        const e = msg.event;
        if (e.kind === 'rejected') toast.error('Deployment rejected', e.reason.replace(/_/g, ' ').toLowerCase());
        if (e.kind === 'building_destroyed') setLog((l) => [`${BUILDING_DEFINITIONS[e.buildingType]?.name ?? e.buildingType} destroyed`, ...l].slice(0, 40));
        if (e.kind === 'star') setLog((l) => [`★ ${e.stars} star${e.stars > 1 ? 's' : ''}!`, ...l].slice(0, 40));
      } else if (msg.type === 'battle:result' && (p.kind === 'battle' || p.kind === 'joining')) {
        setPhase({ kind: 'result', match: p.match, result: msg.result });
        void qc.invalidateQueries({ queryKey: ['village'] });
        void qc.invalidateQueries({ queryKey: ['army'] });
      } else if (msg.type === 'error' && (p.kind === 'joining' || p.kind === 'battle')) {
        toast.error('Battle error', msg.message);
        if (p.kind === 'joining') setPhase({ kind: 'preview', match: p.match });
      }
    });
  }, [socket, qc]);

  const find = async () => {
    setPhase({ kind: 'searching' });
    setState(null);
    setLog([]);
    try {
      const m = await api<Match>('/game/battles/find', { method: 'POST' });
      setPhase({ kind: 'preview', match: m });
      setArmy(m.army);
      setSelectedTroop(Object.keys(m.army)[0] ?? null);
    } catch (e) {
      toast.error('Matchmaking', errorMessage(e));
      setPhase({ kind: 'idle' });
    }
  };
  const next = async () => {
    if (phase.kind !== 'preview') return;
    await api(`/game/battles/${phase.match.battleId}/abandon`, { method: 'POST' }).catch(() => undefined);
    await find();
  };
  const attack = () => {
    if (phase.kind !== 'preview') return;
    if (socket.status !== 'authed') {
      toast.error('Realtime connection not ready', 'Reconnecting to the game server…');
      socket.connect();
      return;
    }
    setPhase({ kind: 'joining', match: phase.match });
    socket.send({ type: 'battle:join', battleId: phase.match.battleId });
  };
  const endBattle = () => {
    if (phase.kind !== 'battle') return;
    socket.send({ type: 'battle:end', battleId: phase.match.battleId });
  };

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, cam: Camera) => {
      if (!match) return;
      drawGround(ctx, match.snapshot.gridSize, cam.zoom, cam.ox, cam.oy, phase.kind === 'battle' || phase.kind === 'preview' ? mask ?? undefined : undefined);
      const hp = new Map(state?.buildings.map((b) => [b.id, b]));
      const buildings = [...match.snapshot.buildings].sort((a, b) => a.x + a.y + a.size - (b.x + b.y + b.size));
      for (const b of buildings) {
        const s = hp.get(b.id);
        drawBuilding(ctx, { type: b.type, level: b.level, x: b.x, y: b.y, size: b.size, zoom: cam.zoom, ox: cam.ox, oy: cam.oy, destroyed: s?.destroyed, hpRatio: s ? s.hp / s.maxHp : undefined });
      }
      if (state) for (const t of [...state.troops].sort((a, b) => a.x + a.y - (b.x + b.y))) drawTroop(ctx, t.troopType, t.x, t.y, cam.zoom, cam.ox, cam.oy, t.hp / t.maxHp, TROOP_DEFINITIONS[t.troopType]?.isFlying ?? false);
    },
    [match, mask, state, phase.kind],
  );

  const onTileClick = (x: number, y: number) => {
    if (phase.kind !== 'battle' || !selectedTroop) return;
    if ((army[selectedTroop] ?? 0) <= 0) return;
    socket.send({ type: 'battle:deploy', battleId: phase.match.battleId, troopType: selectedTroop, x, y });
  };

  const now = Date.now();
  const stars = state?.stars ?? 0;

  if (phase.kind === 'idle' || phase.kind === 'searching') {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <Swords className="mx-auto text-ember-400" size={40} />
        <h2 className="mt-3 font-display text-2xl font-bold text-white">Raid another village</h2>
        <p className="mt-2 text-sm text-slate-400">Matchmaking picks an opponent close to your trophy count. You will see their base before committing. Once you join the battle, your army is spent whether you win or lose.</p>
        <button className="btn-primary mt-6" onClick={find} disabled={phase.kind === 'searching'}>
          {phase.kind === 'searching' ? <Spinner /> : <Search size={16} />} {phase.kind === 'searching' ? 'Searching…' : 'Find opponent'}
        </button>
        <div className="mt-3 text-xs text-slate-500">Realtime link: {socket.status}</div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100vh-7.5rem)] min-h-[520px] flex-col gap-3 lg:flex-row">
      <div className="card relative flex-1 overflow-hidden">
        <IsoCanvas gridSize={match!.snapshot.gridSize} draw={draw} revision={rev} onTileClick={onTileClick} animate={phase.kind === 'battle'} />
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 text-xs">
          <span className="badge bg-ink-900/80">{match!.defender.name} · TH{match!.defender.townHallLevel} · <Trophy size={11} className="ml-1 text-gold-400" /> {match!.defender.trophies}</span>
          {match!.defender.clanName && <span className="badge bg-ink-900/80">{match!.defender.clanName}</span>}
          {phase.kind === 'battle' && state && (
            <>
              <span className="badge bg-ink-900/80 font-mono">{Math.ceil(state.remainingMs / 1000)}s</span>
              <span className="badge bg-ink-900/80">{state.destructionPercent}%</span>
              <span className="badge gap-0.5 bg-ink-900/80">{[0, 1, 2].map((i) => <Star key={i} size={12} className={i < stars ? 'fill-gold-400 text-gold-400' : 'text-slate-600'} />)}</span>
              <span className="badge gap-1 border-gold-500/30 bg-ink-900/80 text-gold-300"><Coins size={11} /> {state.lootGold.toLocaleString()}</span>
              <span className="badge gap-1 border-elixir-500/30 bg-ink-900/80 text-elixir-400"><Flame size={11} /> {state.lootElixir.toLocaleString()}</span>
            </>
          )}
          {phase.kind === 'battle' && prepUntil > now && !state?.troops.length && <span className="badge border-ember-500/40 bg-ink-900/80 text-ember-300">Planning: {Math.ceil((prepUntil - now) / 1000)}s · click outside the red zone to deploy</span>}
        </div>
        {phase.kind === 'battle' && (
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {Object.entries(army).map(([type, count]) => (
                <button key={type} onClick={() => setSelectedTroop(type)} disabled={count <= 0} className={`rounded-xl border px-3 py-2 text-left text-xs transition ${selectedTroop === type ? 'border-ember-400 bg-ember-500/20 text-ember-200' : 'border-white/10 bg-ink-900/85 text-slate-200 hover:bg-white/[0.08]'} disabled:opacity-40`}>
                  <div className="font-semibold">{TROOP_DEFINITIONS[type]?.name ?? type}</div>
                  <div className="font-mono text-[11px]">× {count}</div>
                </button>
              ))}
            </div>
            <button className="btn-danger text-xs" onClick={endBattle}><X size={14} /> End battle</button>
          </div>
        )}
        {phase.kind === 'preview' && (
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-ink-900/90 p-3">
            <div className="text-xs text-slate-300">
              <div className="font-semibold text-slate-100">Scouting report</div>
              Lootable: <span className="text-gold-300">{match!.snapshot.buildings.reduce((s, b) => s + b.storedGold, 0).toLocaleString()} gold</span>, <span className="text-elixir-400">{match!.snapshot.buildings.reduce((s, b) => s + b.storedElixir, 0).toLocaleString()} elixir</span> · {match!.snapshot.buildings.filter((b) => BUILDING_DEFINITIONS[b.type]?.category === 'defense').length} defenses · {match!.snapshot.buildings.filter((b) => b.type === 'wall').length} walls
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs" onClick={next}>Next opponent</button>
              <button className="btn-primary text-xs" onClick={attack}><Swords size={14} /> Attack</button>
            </div>
          </div>
        )}
        {phase.kind === 'joining' && (
          <div className="absolute inset-0 grid place-items-center bg-black/50 text-slate-200"><Spinner /> Entering battle…</div>
        )}
        {phase.kind === 'result' && (
          <div className="absolute inset-0 grid place-items-center bg-black/60 p-4">
            <div className="card w-full max-w-md p-6 text-center">
              <div className="flex justify-center gap-1">{[0, 1, 2].map((i) => <Star key={i} size={28} className={i < phase.result.stars ? 'fill-gold-400 text-gold-400' : 'text-slate-600'} />)}</div>
              <h3 className="mt-2 font-display text-2xl font-bold text-white">{phase.result.victory ? 'Victory' : 'Defeat'}</h3>
              <div className="mt-1 text-sm text-slate-400">{phase.result.destructionPercent}% destruction in {Math.round(phase.result.durationMs / 1000)}s</div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div className="stat"><div className="text-[10px] uppercase text-slate-500">Gold</div><div className="font-bold text-gold-400">+{phase.result.lootGold.toLocaleString()}</div></div>
                <div className="stat"><div className="text-[10px] uppercase text-slate-500">Elixir</div><div className="font-bold text-elixir-400">+{phase.result.lootElixir.toLocaleString()}</div></div>
                <div className="stat"><div className="text-[10px] uppercase text-slate-500">Trophies</div><div className={`font-bold ${phase.result.attackerTrophyDelta >= 0 ? 'text-mint-400' : 'text-rose-400'}`}>{phase.result.attackerTrophyDelta >= 0 ? '+' : ''}{phase.result.attackerTrophyDelta}</div></div>
              </div>
              <div className="mt-2 text-xs text-slate-500">+{phase.result.xpGained} XP · troops used: {Object.entries(phase.result.troopsUsed).map(([t, n]) => `${n} ${TROOP_DEFINITIONS[t]?.name ?? t}`).join(', ') || 'none'}</div>
              <div className="mt-5 flex justify-center gap-2">
                <button className="btn-secondary" onClick={() => setPhase({ kind: 'idle' })}>Back</button>
                <button className="btn-primary" onClick={find}><Search size={14} /> Find another</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="w-full shrink-0 lg:w-[300px]">
        <div className="card flex h-full max-h-[calc(100vh-8rem)] flex-col p-4">
          <div className="font-display font-semibold text-slate-100">Battle log</div>
          <div className="mt-1 text-xs text-slate-500">{phase.kind === 'battle' ? 'Every deployment is validated by the server; results are computed there.' : 'Pick a troop, then click a green tile to deploy.'}</div>
          <ol className="scroll-thin mt-3 flex-1 space-y-1 overflow-y-auto text-xs text-slate-300">
            {log.map((l, i) => <li key={i} className="rounded bg-white/[0.03] px-2 py-1">{l}</li>)}
          </ol>
        </div>
      </div>
    </div>
  );
}
