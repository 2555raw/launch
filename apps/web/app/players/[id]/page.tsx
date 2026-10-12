'use client';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Castle, Hammer, ShieldCheck, UserPlus } from 'lucide-react';
import type { PlayerSummaryDTO, VillageDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useNow, useRequireAuth } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { atLeast } from '@/components/clan/roles';
import type { MyClanResponse } from '@/components/clan/types';
import { AchievementsGrid, type AchievementItem } from '@/components/profile/achievements-grid';
import { BattleHistory, type BattleHistoryItem } from '@/components/profile/battle-history';
import { PlayerStats } from '@/components/profile/player-stats';
import { Empty, PageHeader, Spinner, Stat, timeLeft } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

type PublicProfile = { player: PlayerSummaryDTO; village: Omit<VillageDTO, 'resources'> & { resources?: undefined }; achievements: AchievementItem[]; history: BattleHistoryItem[] };

export default function PublicPlayerPage() {
  const t = useT();
  const user = useRequireAuth({ player: true });
  const { id } = useParams<{ id: string }>();
  const now = useNow(1000);
  const enabled = !!user?.playerId && !!id;
  const profile = useQuery({ queryKey: ['player', id], queryFn: () => api<PublicProfile>(`/game/players/${id}`), enabled });
  const mine = useQuery({ queryKey: ['clan'], queryFn: () => api<MyClanResponse>('/game/clans/mine'), enabled });
  const invite = useMutation({
    mutationFn: () => api<{ invite: unknown }>('/game/clans/invite', { method: 'POST', json: { playerId: id } }),
    onSuccess: () => toast.success(t('Invite sent')),
    onError: (e) => toast.error(t('Could not invite'), errorMessage(e)),
  });

  if (!user) return null;
  if (profile.error) return <Empty title={t('Player not found')} body={errorMessage(profile.error)} />;
  if (!profile.data) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-slate-400">
        <Spinner /> {t('Loading player…')}
      </div>
    );
  }
  const { player, village, achievements, history } = profile.data;
  const isMe = player.id === user.playerId;
  const myRole = mine.data?.role ?? null;
  const inClan = !!mine.data?.clan;
  const inviteReason = isMe ? t('This is you') : player.clan ? t('Already in a clan') : !atLeast(myRole, 'ELDER') ? t('Elders and above can invite') : null;
  const builtCount = village.buildings.filter((b) => b.type !== 'wall').length;
  const walls = village.buildings.length - builtCount;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title={player.name}
        subtitle={`${village.name} · ${isMe ? t('your public profile') : t('public profile')}`}
        actions={
          inClan && !isMe ? (
            <button className="btn-primary" disabled={!!inviteReason || invite.isPending || invite.isSuccess} title={inviteReason ?? undefined} onClick={() => invite.mutate()}>
              {invite.isPending ? <Spinner /> : <UserPlus size={16} />}
              {invite.isSuccess ? t('Invited') : inviteReason ?? t('Invite to clan')}
            </button>
          ) : undefined
        }
      />
      <PlayerStats player={player} linkClan={isMe} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t('Village')} value={<span className="flex items-center gap-1.5"><Castle size={18} /> {t('Town Hall {n}', { n: village.townHallLevel })}</span>} hint={t('{size}×{size} grid', { size: village.gridSize })} accent="ember" />
        <Stat label={t('Buildings')} value={<span className="flex items-center gap-1.5"><Hammer size={18} /> {builtCount}</span>} hint={t('{walls} wall segments · {builders} builders', { walls, builders: village.builders.total })} />
        <Stat label={t('Shield')} value={<span className="flex items-center gap-1.5"><ShieldCheck size={18} /> {village.shieldUntil ? timeLeft(village.shieldUntil, now) : t('None')}</span>} hint={village.shieldUntil ? t('Cannot be attacked right now') : t('Open to attack')} accent={village.shieldUntil ? 'mint' : undefined} />
      </div>
      <AchievementsGrid achievements={achievements} readOnly />
      <BattleHistory battles={history} title="Recent battles" />
    </div>
  );
}
