'use client';
import { VillageView } from '@/components/game/VillageView';
import { useRequireAuth } from '@/lib/hooks';

export default function VillagePage() {
  const user = useRequireAuth({ player: true });
  if (!user) return null;
  return <VillageView />;
}
