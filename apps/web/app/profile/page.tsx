'use client';
import { useQuery } from '@tanstack/react-query';
import type { PlayerSummaryDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useRequireAuth } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { AchievementsGrid, type AchievementItem } from '@/components/profile/achievements-grid';
import { BattleHistory, type BattleHistoryItem } from '@/components/profile/battle-history';
import { PlayerStats } from '@/components/profile/player-stats';
import { Empty, PageHeader, Spinner } from '@/components/ui/primitives';

export default function ProfilePage() {
  const t = useT();
  const user = useRequireAuth({ player: true });
  const enabled = !!user?.playerId;
  const me = useQuery({ queryKey: ['player', 'me'], queryFn: () => api<{ player: PlayerSummaryDTO; achievements: AchievementItem[] }>('/game/player/me'), enabled });
  const history = useQuery({ queryKey: ['battles', 'history'], queryFn: () => api<{ battles: BattleHistoryItem[] }>('/game/battles/history'), enabled });

  if (!user) return null;
  if (me.error) return <Empty title={t('Could not load your profile')} body={errorMessage(me.error)} action={<button className="btn-secondary" onClick={() => void me.refetch()}>{t('Retry')}</button>} />;
  if (!me.data) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-slate-400">
        <Spinner /> {t('Loading profile…')}
      </div>
    );
  }
  const { player, achievements } = me.data;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader title={player.name} subtitle={t('Chief of a level {level} Town Hall · signed in as {username}', { level: player.townHallLevel, username: user.username })} />
      <PlayerStats player={player} />
      <AchievementsGrid achievements={achievements} queryKey={['player', 'me']} />
      {history.error ? (
        <div className="card p-4 text-sm text-rose-300">{t('Battle history unavailable: {error}', { error: errorMessage(history.error) })}</div>
      ) : history.data ? (
        <BattleHistory battles={history.data.battles} />
      ) : (
        <div className="card flex items-center gap-2 p-4 text-sm text-slate-400">
          <Spinner /> {t('Loading battle log…')}
        </div>
      )}
    </div>
  );
}
