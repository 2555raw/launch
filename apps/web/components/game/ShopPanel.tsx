'use client';
import { useState } from 'react';
import type { VillageDTO } from '@launch/types';
import { X } from 'lucide-react';
import { CostLine } from './BuildingPanel';
import type { CatalogEntry } from './useVillage';

const CATS = [
  ['all', 'All'],
  ['resource', 'Resources'],
  ['storage', 'Storage'],
  ['defense', 'Defense'],
  ['army', 'Army'],
  ['wall', 'Walls'],
  ['special', 'Special'],
] as const;

function fmtSec(s: number): string {
  if (s === 0) return 'Instant';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}

export function ShopPanel({ catalog, village, onPlace, onClose }: { catalog: CatalogEntry[]; village: VillageDTO; onPlace: (type: string) => void; onClose: () => void }) {
  const [cat, setCat] = useState<string>('all');
  const counts = new Map<string, number>();
  for (const b of village.buildings) counts.set(b.type, (counts.get(b.type) ?? 0) + 1);
  const items = catalog.filter((c) => c.type !== 'town_hall' && (cat === 'all' || c.category === cat));
  return (
    <div className="card flex h-full max-h-[calc(100vh-8rem)] flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-display text-lg font-bold text-white">Shop</div>
        <button className="btn-ghost p-1" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {CATS.map(([k, label]) => (
          <button key={k} onClick={() => setCat(k)} className={`rounded-lg px-2 py-1 text-xs ${cat === k ? 'bg-ember-500/20 text-ember-300' : 'text-slate-400 hover:bg-white/[0.05]'}`}>{label}</button>
        ))}
      </div>
      <div className="scroll-thin -mr-2 flex-1 space-y-2 overflow-y-auto pr-2">
        {items.map((c) => {
          const have = counts.get(c.type) ?? 0;
          const l1 = c.levels[0];
          const locked = c.maxCount === 0;
          const full = have >= c.maxCount;
          const gemCost = c.type === 'builder_hut' ? [0, 250, 500, 1000, 2000][Math.min(have, 4)] : 0;
          const cost = { ...l1.cost, ...(gemCost ? { gems: gemCost } : {}) };
          const affordable = (cost.gold ?? 0) <= village.resources.gold && (cost.elixir ?? 0) <= village.resources.elixir && (cost.gems ?? 0) <= village.resources.gems;
          return (
            <div key={c.type} className="rounded-xl border border-white/[0.06] bg-ink-800/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{c.name}</div>
                  <div className="text-[11px] text-slate-500">{c.size}×{c.size} · {fmtSec(l1.buildTimeSec)} · {have}/{c.maxCount} built</div>
                </div>
                <span className="badge">{c.category}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{c.description}</p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <CostLine cost={cost} />
                <button className="btn-primary px-3 py-1 text-xs" disabled={locked || full || !affordable} onClick={() => onPlace(c.type)}>
                  {locked ? `Town Hall ${l1.requiredTownHall}` : full ? 'Max built' : !affordable ? 'Too expensive' : 'Place'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
