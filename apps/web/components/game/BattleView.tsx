'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { BUILDING_DEFINITIONS, TROOP_DEFINITIONS, deploymentMask } from '@launch/game-engine';
import type { BattleResultDTO, BattleSnapshot, BattleStateDTO, ServerMessage } from '@launch/types';
import { ArrowLeft, Coins, Flame, Search, Star, Swords, Trophy, X } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { toast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/primitives';
import { IsoCanvas, type Camera } from './IsoCanvas';
import { TerrainCache, drawBuilding, drawTroop } from './sprites';
import { GameTopBar, RoundButton } from './GameHud';

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
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [state, setState] = useState<BattleStateDTO | null>(null);
  const [army, setArmy] = useState<Record<string, number>>({});
  const [selectedTroop, setSelectedTroop] = useState<string | null>(null);
  const [prepUntil, setPrepUntil] = useState<number>(0);
  const [rev, setRev] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const stateRef = useRef(state);
  stateRef.current = state;
  const terrain = useRef(new TerrainCache());

  const match = phase.kind === 'idle' || phase.kind === 'searching' ? null : phase.match;
  const mask = useMemo(() => (match ? deploymentMask(match.snapshot.buildings, match.snapshot.gridSize) : null), [match]);
  const wallSet = useMemo(() => new Set(match?.snapshot.buildings.filter((b) => b.type === 'wall').map((b) => `${b.x},${b.y}`) ?? []), [match]);

  useEffect(() => {
    return socket.subscribe((msg: ServerMessage) => {
      const p = phaseRef.current;
      if (msg.type === 'battle:ready' && (p.kind === 'joining' || p.kind === 'battle')) {
        setArmy(msg.army);
        setPrepUntil(Date.now() + msg.prepMs);
        setPhase({ kind: 'battle', match: p.match });
        setLog((l) => [`Battle ready. Deploy outside the red zone. ${Math.round(msg.prepMs / 1000)}s to plan.`, ...l]);
      } else if (msg.type === 'battle:state' && p.kind === 'battle') {
        setState(msg.state);
        setArmy(msg.state.remainingArmy);
      } else if (msg.type === 'battle:event' && p.kind === 'battle') {
        const e = msg.event;
        if (e.kind === 'rejected') toast.error('Deployment rejected', e.reason.replace(/_/g, ' ').toLowerCase());
        if (e.kind === 'building_destroyed') setLog((l) => [`${BUILDING_DEFINITIONS[e.buildingType]?.name ?? e.buildingType} destroyed`, ...l].slice(0, 30));
        if (e.kind === 'star') setLog((l) => [`★ ${e.stars} star${e.stars > 1 ? 's' : ''}!`, ...l].slice(0, 30));
      } else if (msg.type === 'battle:result' && (p.kind === 'battle' || p.kind === 'joining')) {
        setPhase({ kind: 'result', match: p.match, result: msg.result });
        void qc.invalidateQueries({ queryKey: ['village'] });
        void qc.invalidateQueries({ queryKey: ['army'] });
        void qc.invalidateQueries({ queryKey: ['player-me'] });
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
      setRev((r) => r + 1);
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
    (ctx: CanvasRenderingContext2D, cam: Camera, size: { w: number; h: number; dpr: number }) => {
      if (!match) return;
      const showMask = phase.kind === 'battle' || phase.kind === 'preview';
      terrain.current.draw(ctx, size.w, size.h, size.dpr, { gridSize: match.snapshot.gridSize, zoom: cam.zoom, ox: cam.ox, oy: cam.oy, seed: match.seed, mask: showMask ? (mask ?? undefined) : undefined });
      const t = performance.now();
      const st = stateRef.current;
      const hp = new Map(st?.buildings.map((b) => [b.id, b]));
      const buildings = [...match.snapshot.buildings].sort((a, b) => a.x + a.y + a.size - (b.x + b.y + b.size));
      for (const b of buildings) {
        const s = hp.get(b.id);
        drawBuilding(ctx, { type: b.type, level: b.level, x: b.x, y: b.y, size: b.size, zoom: cam.zoom, ox: cam.ox, oy: cam.oy, destroyed: s?.destroyed, hpRatio: s ? s.hp / s.maxHp : undefined, t, wallLinks: b.type === 'wall' ? { e: wallSet.has(`${b.x + 1},${b.y}`) && !hp.get(`w`)?.destroyed, s: wallSet.has(`${b.x},${b.y + 1}`) } : undefined });
      }
      if (st) for (const tr of [...st.troops].sort((a, b) => a.x + a.y - (b.x + b.y))) drawTroop(ctx, tr.troopType, tr.x, tr.y, cam.zoom, cam.ox, cam.oy, tr.hp / tr.maxHp, TROOP_DEFINITIONS[tr.troopType]?.isFlying ?? false, t);
    },
    [match, mask, phase.kind, wallSet],
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
      <div className="fixed inset-0 grid place-items-center bg-[#1f4a2a] bg-grid-faint bg-[size:28px_28px]">
        <div className="card mx-4 max-w-xl p-8 text-center">
          <Swords className="mx-auto text-ember-400" size={40} />
          <h2 className="mt-3 font-display text-2xl font-bold text-white">Raid another village</h2>
          <p className="mt-2 text-sm text-slate-400">Matchmaking picks an opponent close to your trophy count. You scout their base before committing. Once you join the battle, your army is spent whether you win or lose.</p>
          <div className="mt-6 flex justify-center gap-2">
            <button className="btn-secondary" onClick={() => router.push('/village')}><ArrowLeft size={16} /> Village</button>
            <button className="btn-primary" onClick={find} disabled={phase.kind === 'searching'}>
              {phase.kind === 'searching' ? <Spinner /> : <Search size={16} />} {phase.kind === 'searching' ? 'Searching…' : 'Find opponent'}
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-500">Realtime link: {socket.status}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#1f4a2a]">
      <IsoCanvas gridSize={match!.snapshot.gridSize} draw={draw} revision={rev} onTileClick={onTileClick} animate initialZoomFactor={2.1} />
      <div className="pointer-events-none absolute inset-0">
        <GameTopBar village={undefined} mode="battle" />
        {/* opponent + battle stats */}
        <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1.5 text-xs">
          <div className="rounded-xl border border-black/40 bg-ink-950/85 px-3 py-1.5 text-slate-200 shadow-lg">
            <div className="font-display text-sm font-bold text-white">{match!.defender.name}</div>
            <div className="flex items-center gap-2 text-gold-300"><Trophy size={12} /> {match!.defender.trophies} <span className="text-slate-500">· TH{match!.defender.townHallLevel}{match!.defender.clanName ? ` · ${match!.defender.clanName}` : ''}</span></div>
          </div>
          {phase.kind === 'battle' && state && (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-black/40 bg-ink-950/85 px-3 py-1 font-mono text-sm text-white">{Math.ceil(state.remainingMs / 1000)}s</span>
              <span className="rounded-full border border-black/40 bg-ink-950/85 px-3 py-1 font-display text-sm font-bold text-white">{state.destructionPercent}%</span>
              <span className="flex gap-0.5 rounded-full border border-black/40 bg-ink-950/85 px-2 py-1">{[0, 1, 2].map((i) => <Star key={i} size={14} className={i < stars ? 'fill-gold-400 text-gold-400' : 'text-slate-600'} />)}</span>
            </div>
          )}
          {phase.kind === 'battle' && state && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-full border border-gold-500/30 bg-ink-950/85 px-3 py-1 text-gold-300"><Coins size={12} /> +{state.lootGold.toLocaleString()}</span>
              <span className="flex items-center gap-1 rounded-full border border-elixir-500/30 bg-ink-950/85 px-3 py-1 text-elixir-400"><Flame size={12} /> +{state.lootElixir.toLocaleString()}</span>
            </div>
          )}
          {phase.kind === 'battle' && prepUntil > now && !state?.troops.length && <span className="rounded-full border border-ember-500/40 bg-ink-950/85 px-3 py-1 text-ember-300">Planning {Math.ceil((prepUntil - now) / 1000)}s · tap a green tile to deploy</span>}
        </div>

        {/* battle log */}
        <div className="pointer-events-none absolute left-3 top-20 hidden w-64 md:block">
          <ol className="space-y-1 text-xs text-slate-200">
            {log.slice(0, 6).map((l, i) => <li key={i} className="rounded bg-ink-950/70 px-2 py-1" style={{ opacity: 1 - i * 0.14 }}>{l}</li>)}
          </ol>
        </div>

        {/* bottom: troop bar / preview actions */}
        {phase.kind === 'battle' && (
          <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-end gap-2">
            {Object.entries(army).map(([type, count]) => (
              <button key={type} onClick={() => setSelectedTroop(type)} disabled={count <= 0} className={`relative grid h-16 w-16 place-items-center rounded-2xl border-2 text-center transition ${selectedTroop === type ? 'border-ember-300 bg-gradient-to-b from-ember-500/40 to-ink-900 text-ember-100' : 'border-black/50 bg-gradient-to-b from-ink-700 to-ink-900 text-slate-200'} disabled:opacity-40`}>
                <span className="font-display text-sm font-bold">{(TROOP_DEFINITIONS[type]?.name ?? type).slice(0, 6)}</span>
                <span className="absolute -top-2 right-1 rounded-full bg-ink-950 px-1.5 font-mono text-[11px] text-white">×{count}</span>
              </button>
            ))}
            <RoundButton icon={<X size={22} />} label="End" onClick={endBattle} />
          </div>
        )}
        {phase.kind === 'preview' && (
          <div className="pointer-events-auto absolute bottom-4 left-1/2 flex w-[min(96vw,760px)] -translate-x-1/2 flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/50 bg-ink-950/90 p-3 shadow-lg">
            <div className="text-xs text-slate-300">
              <div className="font-display text-sm font-semibold text-white">Scouting report</div>
              <span className="text-gold-300">{match!.snapshot.buildings.reduce((s, b) => s + b.storedGold, 0).toLocaleString()} gold</span> · <span className="text-elixir-400">{match!.snapshot.buildings.reduce((s, b) => s + b.storedElixir, 0).toLocaleString()} elixir</span> · {match!.snapshot.buildings.filter((b) => BUILDING_DEFINITIONS[b.type]?.category === 'defense').length} defenses · {match!.snapshot.buildings.filter((b) => b.type === 'wall').length} walls
              <div className="mt-1 text-slate-500">Your army: {Object.entries(army).map(([k, n]) => `${n} ${TROOP_DEFINITIONS[k]?.name ?? k}`).join(', ')}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => router.push('/village')}><ArrowLeft size={14} /> Home</button>
              <button className="btn-secondary" onClick={next}>Next</button>
              <button className="btn-primary" onClick={attack}><Swords size={14} /> Attack!</button>
            </div>
          </div>
        )}
        {phase.kind === 'joining' && <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-black/50 text-slate-200"><span className="inline-flex items-center gap-2"><Spinner /> Entering battle…</span></div>}
        {phase.kind === 'result' && (
          <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-black/60 p-4">
            <div className="card w-full max-w-md p-6 text-center">
              <div className="flex justify-center gap-1">{[0, 1, 2].map((i) => <Star key={i} size={32} className={i < phase.result.stars ? 'fill-gold-400 text-gold-400' : 'text-slate-600'} />)}</div>
              <h3 className="mt-2 font-display text-3xl font-extrabold text-white">{phase.result.victory ? 'Victory' : 'Defeat'}</h3>
              <div className="mt-1 text-sm text-slate-400">{phase.result.destructionPercent}% destruction in {Math.round(phase.result.durationMs / 1000)}s</div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div className="stat"><div className="text-[10px] uppercase text-slate-500">Gold</div><div className="font-bold text-gold-400">+{phase.result.lootGold.toLocaleString()}</div></div>
                <div className="stat"><div className="text-[10px] uppercase text-slate-500">Elixir</div><div className="font-bold text-elixir-400">+{phase.result.lootElixir.toLocaleString()}</div></div>
                <div className="stat"><div className="text-[10px] uppercase text-slate-500">Trophies</div><div className={`font-bold ${phase.result.attackerTrophyDelta >= 0 ? 'text-mint-400' : 'text-rose-400'}`}>{phase.result.attackerTrophyDelta >= 0 ? '+' : ''}{phase.result.attackerTrophyDelta}</div></div>
              </div>
              <div className="mt-2 text-xs text-slate-500">+{phase.result.xpGained} XP · {Object.entries(phase.result.troopsUsed).map(([t, n]) => `${n} ${TROOP_DEFINITIONS[t]?.name ?? t}`).join(', ') || 'no troops used'}</div>
              <div className="mt-5 flex justify-center gap-2">
                <button className="btn-secondary" onClick={() => router.push('/village')}>Return home</button>
                <button className="btn-primary" onClick={find}><Search size={14} /> Find another</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
