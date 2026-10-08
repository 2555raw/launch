'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BUILDING_DEFINITIONS, validatePlacement } from '@launch/game-engine';
import type { BuildingDTO } from '@launch/types';
import { Hammer, ShieldCheck, X } from 'lucide-react';
import { IsoCanvas, type Camera } from './IsoCanvas';
import { TerrainCache, drawBuilding } from './sprites';
import { useVillage } from './useVillage';
import { BuildingPanel } from './BuildingPanel';
import { ShopPanel } from './ShopPanel';
import { GameBottomBar, GameTopBar } from './GameHud';
import { Spinner } from '@/components/ui/primitives';
import { useNow } from '@/lib/hooks';

type Mode = { kind: 'idle' } | { kind: 'place'; type: string } | { kind: 'move'; id: string };

function seedFrom(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function VillageView() {
  const v = useVillage();
  const now = useNow(1000);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [rev, setRev] = useState(0);
  const dragPos = useRef<{ x: number; y: number } | null>(null);
  const terrain = useRef(new TerrainCache());
  const data = v.query.data;
  const village = data?.village;
  const buildings = useMemo(() => village?.buildings ?? [], [village]);
  const selected = buildings.find((b) => b.id === selectedId) ?? null;
  const wallSet = useMemo(() => new Set(buildings.filter((b) => b.type === 'wall').map((b) => `${b.x},${b.y}`)), [buildings]);
  const occupied = useMemo(() => {
    if (!village) return undefined;
    const g = village.gridSize;
    const m = new Uint8Array(g * g);
    for (const b of buildings) for (let y = b.y; y < b.y + b.size; y++) for (let x = b.x; x < b.x + b.size; x++) if (x >= 0 && y >= 0 && x < g && y < g) m[y * g + x] = 1;
    return m;
  }, [buildings, village]);

  useEffect(() => setRev((r) => r + 1), [buildings, mode, hover, selectedId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMode({ kind: 'idle' });
        setSelectedId(null);
        setShopOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const placementOk = useCallback(
    (type: string, x: number, y: number, excludeId?: string) => (village ? validatePlacement(buildings, type, x, y, village.gridSize, excludeId).ok : false),
    [buildings, village],
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, cam: Camera, size: { w: number; h: number; dpr: number }) => {
      if (!village) return;
      terrain.current.draw(ctx, size.w, size.h, size.dpr, { gridSize: village.gridSize, zoom: cam.zoom, ox: cam.ox, oy: cam.oy, seed: seedFrom(village.id), occupied });
      const t = performance.now();
      const list: Array<BuildingDTO & { ghost?: boolean; invalid?: boolean }> = buildings.map((b) => (mode.kind === 'move' && mode.id === b.id && dragPos.current ? { ...b, x: dragPos.current.x, y: dragPos.current.y, ghost: true, invalid: !placementOk(b.type, dragPos.current.x, dragPos.current.y, b.id) } : b));
      if (mode.kind === 'place' && hover) {
        const def = BUILDING_DEFINITIONS[mode.type];
        if (def) list.push({ id: '__ghost', type: mode.type, level: 1, x: hover.x, y: hover.y, size: def.size, state: 'IDLE', constructionStartedAt: null, constructionEndsAt: null, hp: 0, ghost: true, invalid: !placementOk(mode.type, hover.x, hover.y) });
      }
      list.sort((a, b) => a.x + a.y + a.size - (b.x + b.y + b.size));
      for (const b of list) {
        drawBuilding(ctx, {
          type: b.type,
          level: b.level,
          x: b.x,
          y: b.y,
          size: b.size,
          zoom: cam.zoom,
          ox: cam.ox,
          oy: cam.oy,
          state: b.state,
          selected: b.id === selectedId,
          ghost: b.ghost,
          invalid: b.invalid,
          t,
          wallLinks: b.type === 'wall' ? { n: wallSet.has(`${b.x},${b.y - 1}`), e: wallSet.has(`${b.x + 1},${b.y}`), s: wallSet.has(`${b.x},${b.y + 1}`), w: wallSet.has(`${b.x - 1},${b.y}`) } : undefined,
        });
      }
    },
    [village, buildings, mode, hover, selectedId, placementOk, wallSet, occupied],
  );

  const buildingAt = (x: number, y: number) => buildings.find((b) => x >= b.x && x < b.x + b.size && y >= b.y && y < b.y + b.size) ?? null;

  const onTileClick = (x: number, y: number) => {
    if (!village) return;
    if (mode.kind === 'place') {
      if (!placementOk(mode.type, x, y)) return;
      v.place.mutate({ type: mode.type, x, y });
      if (mode.type !== 'wall') setMode({ kind: 'idle' });
      return;
    }
    const b = buildingAt(x, y);
    setSelectedId(b?.id ?? null);
    if (b) setShopOpen(false);
    if (!b) setMode({ kind: 'idle' });
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#1f4a2a]">
      {!village ? (
        <div className="grid h-full place-items-center text-slate-200">
          <span className="inline-flex items-center gap-2"><Spinner /> Loading your village…</span>
        </div>
      ) : (
        <IsoCanvas
          gridSize={village.gridSize}
          draw={draw}
          revision={rev}
          animate
          initialZoomFactor={2.1}
          onTileClick={onTileClick}
          onTileHover={(x, y) => setHover((h) => (h && h.x === x && h.y === y ? h : { x, y }))}
          onTileDragStart={(x, y) => {
            if (mode.kind !== 'move') return false;
            const b = buildings.find((bb) => bb.id === mode.id);
            if (!b || !(x >= b.x && x < b.x + b.size && y >= b.y && y < b.y + b.size)) return false;
            dragPos.current = { x: b.x, y: b.y };
            return true;
          }}
          onTileDrag={(x, y) => {
            if (mode.kind !== 'move') return;
            const b = buildings.find((bb) => bb.id === mode.id)!;
            dragPos.current = { x: Math.max(0, Math.min(village.gridSize - b.size, x - Math.floor(b.size / 2))), y: Math.max(0, Math.min(village.gridSize - b.size, y - Math.floor(b.size / 2))) };
            setRev((r) => r + 1);
          }}
          onTileDragEnd={() => {
            if (mode.kind !== 'move' || !dragPos.current) return;
            const b = buildings.find((bb) => bb.id === mode.id)!;
            const p = dragPos.current;
            dragPos.current = null;
            if (placementOk(b.type, p.x, p.y, b.id) && (p.x !== b.x || p.y !== b.y)) v.move.mutate({ id: b.id, x: p.x, y: p.y });
            setMode({ kind: 'idle' });
          }}
        />
      )}

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0">
        <GameTopBar village={village} mode="village" />
        {village && (
          <div className="pointer-events-none absolute left-1/2 top-3 hidden -translate-x-1/2 items-center gap-2 text-xs md:flex">
            <span className="rounded-full border border-black/40 bg-ink-950/85 px-3 py-1 text-slate-200"><Hammer size={12} className="mr-1 inline" />Builders {village.builders.total - village.builders.busy}/{village.builders.total}</span>
            <span className="rounded-full border border-black/40 bg-ink-950/85 px-3 py-1 text-slate-200">Town Hall {village.townHallLevel}</span>
            {village.shieldUntil && <span className="rounded-full border border-mint-500/40 bg-ink-950/85 px-3 py-1 text-mint-400"><ShieldCheck size={12} className="mr-1 inline" />Shield</span>}
          </div>
        )}
        {mode.kind !== 'idle' && (
          <div className="pointer-events-auto absolute left-1/2 top-16 -translate-x-1/2 rounded-full border border-ember-500/50 bg-ink-950/90 px-4 py-1.5 text-xs text-ember-200 shadow-glow">
            {mode.kind === 'place' ? `Placing ${BUILDING_DEFINITIONS[mode.type]?.name} · click a tile` : 'Drag the building to a new spot'}
            <button className="ml-3 rounded-full bg-white/10 px-2 py-0.5 text-slate-200" onClick={() => setMode({ kind: 'idle' })}><X size={12} className="inline" /> stop</button>
          </div>
        )}
        <GameBottomBar onShop={() => { setShopOpen((o) => !o); setSelectedId(null); }} />
      </div>

      {/* Side panels */}
      {shopOpen && data && (
        <div className="absolute bottom-24 right-3 top-20 w-[min(92vw,360px)]">
          <ShopPanel
            catalog={data.catalog}
            village={data.village}
            onClose={() => setShopOpen(false)}
            onPlace={(type) => {
              setShopOpen(false);
              setSelectedId(null);
              setMode({ kind: 'place', type });
            }}
          />
        </div>
      )}
      {selected && village && !shopOpen && (
        <div className="absolute bottom-24 right-3 w-[min(92vw,340px)] max-h-[calc(100vh-11rem)] overflow-y-auto scroll-thin">
          <BuildingPanel
            building={selected}
            village={village}
            now={now}
            onMove={() => setMode({ kind: 'move', id: selected.id })}
            onUpgrade={() => v.upgrade.mutate(selected.id)}
            onCollect={() => v.collect.mutate(selected.id)}
            onCancel={() => v.cancel.mutate(selected.id)}
            onSkip={() => v.skip.mutate(selected.id)}
            onRemove={() => {
              if (window.confirm('Remove this building? Resources are not refunded.')) {
                v.remove.mutate(selected.id);
                setSelectedId(null);
              }
            }}
            busy={v.upgrade.isPending || v.collect.isPending || v.cancel.isPending || v.skip.isPending || v.remove.isPending}
          />
        </div>
      )}
    </div>
  );
}
