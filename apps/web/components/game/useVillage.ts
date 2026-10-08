'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BuildingDTO, VillageDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import type { BuildingLevel } from '@launch/game-engine';

export interface CatalogEntry {
  type: string;
  name: string;
  description: string;
  category: string;
  size: number;
  maxCount: number;
  maxLevel: number;
  levels: BuildingLevel[];
}

export interface VillageResponse {
  village: VillageDTO;
  catalog: CatalogEntry[];
}

export function useVillage() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['village'], queryFn: () => api<VillageResponse>('/game/village'), refetchInterval: 15_000 });
  const refresh = () => qc.invalidateQueries({ queryKey: ['village'] });
  const update = (village: VillageDTO) => qc.setQueryData<VillageResponse>(['village'], (old) => (old ? { ...old, village } : old));

  const act = <TArgs,>(fn: (args: TArgs) => Promise<{ village?: VillageDTO; building?: BuildingDTO | null } & Record<string, unknown>>, success?: (r: Record<string, unknown>) => string | undefined) =>
    useMutation({
      mutationFn: fn,
      onSuccess: (r) => {
        if (r.village) update(r.village);
        else void refresh();
        const msg = success?.(r);
        if (msg) toast.success(msg);
      },
      onError: (e) => toast.error('Action failed', errorMessage(e)),
    });

  const place = act((a: { type: string; x: number; y: number }) => api('/game/buildings', { method: 'POST', json: a }));
  const move = useMutation({
    mutationFn: (a: { id: string; x: number; y: number }) => api<{ building: BuildingDTO }>(`/game/buildings/${a.id}/move`, { method: 'PATCH', json: { x: a.x, y: a.y } }),
    onSuccess: () => void refresh(),
    onError: (e) => toast.error('Cannot move there', errorMessage(e)),
  });
  const upgrade = act((id: string) => api(`/game/buildings/${id}/upgrade`, { method: 'POST' }), () => 'Upgrade started');
  const cancel = act((id: string) => api(`/game/buildings/${id}/cancel`, { method: 'POST' }), () => 'Construction cancelled (50% refunded)');
  const collect = act((id: string) => api(`/game/buildings/${id}/collect`, { method: 'POST' }), (r) => (r.collected ? `Collected ${(r.collected as number).toLocaleString()} ${r.resource as string}` : 'Nothing to collect yet'));
  const skip = act((id: string) => api(`/game/buildings/${id}/skip`, { method: 'POST' }), () => 'Construction finished');
  const remove = act((id: string) => api(`/game/buildings/${id}`, { method: 'DELETE' }), () => 'Building removed');

  return { query, refresh, place, move, upgrade, cancel, collect, skip, remove };
}
