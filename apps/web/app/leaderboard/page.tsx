'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Crown, Medal, Trophy, Users } from 'lucide-react';
import type { ClanType } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { CLAN_TYPE_LABEL } from '@/components/clan/types';
import { Empty, PageHeader, Spinner, fmt } from '@/components/ui/primitives';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';

interface PlayerRow {
  rank: number;
  id: string;
  name: string;
  level: number;
  trophies: number;
  attacksWon: number;
  clan: { id: string; name: string; tag: string } | null;
}
interface ClanRow {
  rank: number;
  id: string;
  name: string;
  tag: string;
  badge: string;
  trophies: number;
  members: number;
  type: ClanType;
}

function Rank({ n }: { n: number }) {
  if (n === 1) return <span className="flex items-center gap-1 font-display font-bold text-gold-300"><Crown size={14} /> 1</span>;
  if (n <= 3) return <span className="flex items-center gap-1 font-display font-bold text-slate-200"><Medal size={14} className={n === 2 ? 'text-slate-300' : 'text-amber-600'} /> {n}</span>;
  return <span className="font-mono text-slate-400">{n}</span>;
}

function PlayersBoard() {
  const me = useAuth((s) => s.user);
  const q = useInfiniteQuery({
    queryKey: ['leaderboard', 'players'],
    queryFn: ({ pageParam }) => api<{ items: PlayerRow[]; nextCursor: string | null }>(`/game/leaderboard/players?limit=50${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  if (q.isLoading) return <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Ranking the realm…</div>;
  if (q.error) return <Empty title="Could not load leaderboard" body={errorMessage(q.error)} action={<button className="btn-secondary" onClick={() => void q.refetch()}>Retry</button>} />;
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  if (rows.length === 0) return <Empty title="No players ranked yet" />;
  return (
    <div className="card p-2 sm:p-4">
      <Table>
        <thead>
          <tr>
            <Th className="w-16">Rank</Th>
            <Th>Player</Th>
            <Th className="text-right">Level</Th>
            <Th className="text-right">Trophies</Th>
            <Th className="text-right">Attacks won</Th>
            <Th>Clan</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <Tr key={p.id} highlight={p.id === me?.playerId}>
              <Td><Rank n={p.rank} /></Td>
              <Td>
                <Link href={`/players/${p.id}`} className="font-semibold text-slate-100 hover:text-ember-300">
                  {p.name}
                </Link>
                {p.id === me?.playerId && <span className="ml-2 text-[10px] uppercase text-ember-300">you</span>}
              </Td>
              <Td className="text-right font-mono">{p.level}</Td>
              <Td className="text-right font-mono text-gold-300">{fmt(p.trophies)}</Td>
              <Td className="text-right font-mono">{fmt(p.attacksWon)}</Td>
              <Td className="text-xs text-slate-400">{p.clan ? <>{p.clan.name} <span className="font-mono text-slate-600">[{p.clan.tag}]</span></> : '—'}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      {q.hasNextPage && (
        <div className="mt-3 text-center">
          <button className="btn-secondary" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {q.isFetchingNextPage ? <Spinner /> : null} Load more
          </button>
        </div>
      )}
    </div>
  );
}

function ClansBoard() {
  const me = useAuth((s) => s.user);
  const myClan = useQuery({ queryKey: ['clan'], queryFn: () => api<{ clan: { id: string } | null }>('/game/clans/mine'), enabled: !!me?.playerId });
  const q = useQuery({ queryKey: ['leaderboard', 'clans'], queryFn: () => api<{ items: ClanRow[] }>('/game/leaderboard/clans?limit=100') });
  if (q.isLoading) return <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Ranking the clans…</div>;
  if (q.error) return <Empty title="Could not load leaderboard" body={errorMessage(q.error)} action={<button className="btn-secondary" onClick={() => void q.refetch()}>Retry</button>} />;
  const rows = q.data?.items ?? [];
  if (rows.length === 0) return <Empty title="No clans yet" body="Found one from the Clan page." />;
  return (
    <div className="card p-2 sm:p-4">
      <Table>
        <thead>
          <tr>
            <Th className="w-16">Rank</Th>
            <Th>Clan</Th>
            <Th>Tag</Th>
            <Th className="text-right">Trophies</Th>
            <Th className="text-right">Members</Th>
            <Th>Type</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <Tr key={c.id} highlight={c.id === myClan.data?.clan?.id}>
              <Td><Rank n={c.rank} /></Td>
              <Td className="font-semibold text-slate-100">{c.name}</Td>
              <Td className="font-mono text-xs text-slate-400">[{c.tag}]</Td>
              <Td className="text-right font-mono text-gold-300">{fmt(c.trophies)}</Td>
              <Td className="text-right font-mono">{c.members}/50</Td>
              <Td><span className="badge">{CLAN_TYPE_LABEL[c.type]}</span></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<'players' | 'clans'>('players');
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Leaderboard" subtitle="The most decorated chiefs and clans of Emberhold." actions={<Tabs items={[{ key: 'players', label: <span className="flex items-center gap-1.5"><Trophy size={14} /> Players</span> }, { key: 'clans', label: <span className="flex items-center gap-1.5"><Users size={14} /> Clans</span> }]} value={tab} onChange={setTab} />} />
      {tab === 'players' ? <PlayersBoard /> : <ClansBoard />}
    </div>
  );
}
