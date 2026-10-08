'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BUILDING_DEFINITIONS, validatePlacement } from '@launch/game-engine';
import type { BuildingDTO } from '@launch/types';
import { IsoCanvas, type Camera } from './IsoCanvas';
import { drawBuilding, drawGround } from './sprites';
import { useVillage } from './useVillage';
import { BuildingPanel } from './BuildingPanel';
import { ShopPanel } from './ShopPanel';
import { Spinner } from '@/components/ui/primitives';
import { useNow } from '@/lib/hooks';
import { Hammer, ShieldCheck, Store } from 'lucide-react';

type Mode = { kind: 'idle' } | { kind: 'place'; type: string } | { kind: 'move'; id: string };

export function VillageView() {
  const v = useVillage();
  const now = useNow(1000);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [rev, setRev] = useState(0);
  const dragPos = useRef<{ x: number; y: number } | null>(null);
  const data = v.query.data;
  const village = data?.village;
  const buildings = useMemo(() => village?.buildings ?? [], [village]);
  const selected = buildings.find((b) => b.id === selectedId) ?? null;

  useEffect(() => setRev((r) => r + 1), [buildings, mode, hover, selectedId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMode({ kind: 'idle' });
        setSelectedId(null);
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
    (ctx: CanvasRenderingContext2D, cam: Camera) => {
      if (!village) return;
      drawGround(ctx, village.gridSize, cam.zoom, cam.ox, cam.oy);
      const list: Array<BuildingDTO & { ghost?: boolean; invalid?: boolean }> = buildings.map((b) => (mode.kind === 'move' && mode.id === b.id && dragPos.current ? { ...b, x: dragPos.current.x, y: dragPos.current.y, ghost: true, invalid: !placementOk(b.type, dragPos.current.x, dragPos.current.y, b.id) } : b));
      if (mode.kind === 'place' && hover) {
        const def = BUILDING_DEFINITIONS[mode.type];
        if (def) list.push({ id: '__ghost', type: mode.type, level: 1, x: hover.x, y: hover.y, size: def.size, state: 'IDLE', constructionStartedAt: null, constructionEndsAt: null, hp: 0, ghost: true, invalid: !placementOk(mode.type, hover.x, hover.y) });
      }
      list.sort((a, b) => a.x + a.y + a.size - (b.x + b.y + b.size));
      for (const b of list) drawBuilding(ctx, { type: b.type, level: b.level, x: b.x, y: b.y, size: b.size, zoom: cam.zoom, ox: cam.ox, oy: cam.oy, state: b.state, selected: b.id === selectedId, ghost: b.ghost, invalid: b.invalid });
    },
    [village, buildings, mode, hover, selectedId, placementOk],
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
    if (!b) setMode({ kind: 'idle' });
  };

  return (
    <div className="relative flex h-[calc(100vh-7.5rem)] min-h-[520px] flex-col gap-3 lg:flex-row">
      <div className="card relative flex-1 overflow-hidden">
        {!village ? (
          <div className="grid h-full place-items-center text-slate-400">
            <Spinner /> Loading your village…
          </div>
        ) : (
          <IsoCanvas
            gridSize={village.gridSize}
            draw={draw}
            revision={rev}
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
        {village && (
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 text-xs">
            <span className="badge gap-1 bg-ink-900/80"><Hammer size={12} /> Builders {village.builders.total - village.builders.busy}/{village.builders.total} free</span>
            <span className="badge bg-ink-900/80">Town Hall {village.townHallLevel}</span>
            {village.shieldUntil && <span className="badge gap-1 border-mint-500/40 bg-ink-900/80 text-mint-400"><ShieldCheck size={12} /> Shield active</span>}
            {mode.kind === 'place' && <span className="badge border-ember-500/40 bg-ink-900/80 text-ember-300">Placing {BUILDING_DEFINITIONS[mode.type]?.name} · click a tile · Esc to stop</span>}
            {mode.kind === 'move' && <span className="badge border-ember-500/40 bg-ink-900/80 text-ember-300">Drag the building to a new spot · Esc to cancel</span>}
          </div>
        )}
        <div className="absolute bottom-3 left-3 flex gap-2">
          <button className="btn-primary" onClick={() => setShopOpen((o) => !o)}>
            <Store size={16} /> Shop
          </button>
        </div>
        <div className="pointer-events-none absolute bottom-3 right-3 text-[11px] text-slate-500">drag to pan · wheel to zoom · double-click to fit</div>
      </div>
      <div className="w-full shrink-0 lg:w-[340px]">
        {shopOpen && data ? (
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
        ) : selected && village ? (
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
        ) : (
          <div className="card p-4 text-sm text-slate-400">
            <div className="font-display font-semibold text-slate-200">Your village</div>
            <p className="mt-1">Select a building to see its stats and actions. Open the shop to construct new buildings. Everything you do here is validated and saved by the server.</p>
            {village && (
              <ul className="mt-3 space-y-1 text-xs">
                <li>Buildings: {village.buildings.length}</li>
                <li>Under construction: {village.buildings.filter((b) => b.state !== 'IDLE').length}</li>
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
