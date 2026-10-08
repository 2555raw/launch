'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PlayerSummaryDTO, VillageDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useRequireAuth } from '@/lib/hooks';
import { ClanBrowse } from '@/components/clan/clan-browse';
import { ClanChat } from '@/components/clan/clan-chat';
import { ClanCreateForm } from '@/components/clan/clan-create-form';
import { ClanHeader } from '@/components/clan/clan-header';
import { ClanInvites } from '@/components/clan/clan-invites';
import { ClanSettings } from '@/components/clan/clan-settings';
import { InviteSearch } from '@/components/clan/invite-search';
import { MembersTable } from '@/components/clan/members-table';
import { atLeast } from '@/components/clan/roles';
import { TroopRequests } from '@/components/clan/troop-requests';
import type { MyClanResponse } from '@/components/clan/types';
import { Empty, PageHeader, Spinner } from '@/components/ui/primitives';

export default function ClanPage() {
  const user = useRequireAuth({ player: true });
  const enabled = !!user?.playerId;
  const mine = useQuery({ queryKey: ['clan'], queryFn: () => api<MyClanResponse>('/game/clans/mine'), enabled, refetchInterval: 30_000 });
  const village = useQuery({ queryKey: ['village'], queryFn: () => api<{ village: VillageDTO }>('/game/village'), enabled });
  const me = useQuery({ queryKey: ['player', 'me'], queryFn: () => api<{ player: PlayerSummaryDTO }>('/game/player/me'), enabled: enabled && mine.data?.clan === null });
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!user) return null;
  if (mine.error) return <Empty title="Could not load clan" body={errorMessage(mine.error)} action={<button className="btn-secondary" onClick={() => void mine.refetch()}>Retry</button>} />;
  if (!mine.data) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-slate-400">
        <Spinner /> Loading clan…
      </div>
    );
  }

  const { clan, role, invites, messages } = mine.data;
  const myPlayerId = user.playerId!;

  if (!clan || !role) {
    const buildings = village.data?.village.buildings;
    const hasClanHall = buildings ? buildings.some((b) => b.type === 'clan_hall' && b.state !== 'CONSTRUCTING') : undefined;
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Clan" subtitle="Join forces: share troops, chat and climb the clan leaderboard together." />
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <ClanInvites invites={invites} />
            <ClanBrowse myTrophies={me.data?.player.trophies} />
          </div>
          <div className="lg:col-span-2">
            <ClanCreateForm gold={village.data?.village.resources.gold} hasClanHall={hasClanHall} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <ClanHeader clan={clan} role={role} settingsOpen={settingsOpen} onToggleSettings={() => setSettingsOpen((o) => !o)} />
      {settingsOpen && atLeast(role, 'CO_LEADER') && <ClanSettings key={clan.id + clan.badge + clan.type + clan.requiredTrophies + clan.description} clan={clan} onSaved={() => setSettingsOpen(false)} />}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <MembersTable members={clan.members} myRole={role} myPlayerId={myPlayerId} />
          <TroopRequests requests={clan.requests} myPlayerId={myPlayerId} />
        </div>
        <div className="space-y-4 lg:col-span-1">
          <ClanChat clanId={clan.id} initial={messages ?? []} myPlayerId={myPlayerId} />
          {atLeast(role, 'ELDER') && <InviteSearch />}
        </div>
      </div>
    </div>
  );
}
