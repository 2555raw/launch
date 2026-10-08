'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BuildingDefinition, TroopDefinition } from '@launch/game-engine';
import type { ArmyDTO, VillageDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useRequireAuth } from '@/lib/hooks';
import { ArmyComposition } from '@/components/army/army-composition';
import { HousingBar } from '@/components/army/housing-bar';
import { ResearchPanel } from '@/components/army/research-panel';
import { TrainingQueue } from '@/components/army/training-queue';
import { TroopCard } from '@/components/army/troop-card';
import { Empty, PageHeader, Spinner } from '@/components/ui/primitives';

type Catalog = { troops: TroopDefinition[]; buildings: BuildingDefinition[] };

export default function ArmyPage() {
  const user = useRequireAuth({ player: true });
  const enabled = !!user?.playerId;

  const army = useQuery({ queryKey: ['army'], queryFn: () => api<{ army: ArmyDTO }>('/game/army'), enabled, refetchInterval: 10_000 });
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => api<Catalog>('/game/catalog'), enabled, staleTime: Infinity });
  const village = useQuery({ queryKey: ['village'], queryFn: () => api<{ village: VillageDTO }>('/game/village'), enabled });

  const buildings = village.data?.village.buildings ?? [];
  const working = useMemo(() => buildings.filter((b) => b.state !== 'CONSTRUCTING'), [buildings]);
  const barracksLevel = Math.max(0, ...working.filter((b) => b.type === 'barracks').map((b) => b.level));
  const barracksCount = working.filter((b) => b.type === 'barracks').length || 1;
  const labLevel = Math.max(0, ...working.filter((b) => b.type === 'laboratory').map((b) => b.level));
  const elixir = village.data?.village.resources.elixir ?? 0;
  const troops = useMemo(() => [...(catalog.data?.troops ?? [])].sort((a, b) => a.requiredBarracksLevel - b.requiredBarracksLevel), [catalog.data]);

  if (!user) return null;
  const error = army.error ?? catalog.error ?? village.error;
  if (error && !army.data) return <Empty title="Could not load your army" body={errorMessage(error)} action={<button className="btn-secondary" onClick={() => void army.refetch()}>Retry</button>} />;
  if (!army.data || !catalog.data) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-slate-400">
        <Spinner /> Mustering the troops…
      </div>
    );
  }
  const a = army.data.army;
  const housingFree = Math.max(0, a.housingCapacity - a.housingUsed);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Army" subtitle={`Barracks level ${barracksLevel || '—'} · ${barracksCount} working barracks · Laboratory ${labLevel ? `level ${labLevel}` : 'not built'}`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <HousingBar army={a} />
          <ArmyComposition army={a} />
          <TrainingQueue army={a} />
          <section>
            <h2 className="mb-3 font-display text-lg font-bold text-white">Troops</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {troops.map((def) => (
                <TroopCard key={def.type} def={def} level={a.troopLevels[def.type]} housingFree={housingFree} elixir={elixir} barracksCount={barracksCount} />
              ))}
            </div>
          </section>
        </div>
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <ResearchPanel army={a} troops={troops} labLevel={labLevel} elixir={elixir} />
          </div>
        </div>
      </div>
    </div>
  );
}
