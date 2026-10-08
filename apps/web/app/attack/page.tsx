'use client';
import { BattleView } from '@/components/game/BattleView';
import { useRequireAuth } from '@/lib/hooks';

export default function AttackPage() {
  const user = useRequireAuth({ player: true });
  if (!user) return null;
  return <BattleView />;
}
