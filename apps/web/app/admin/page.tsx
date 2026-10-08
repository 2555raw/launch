'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Ban, Castle, Coins, Flag, Rocket, Swords, UserPlus, Users, UsersRound } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { Empty, PageHeader, Spinner, fmt } from '@/components/ui/primitives';

interface AdminStats {
  users: number;
  players: number;
  battles: number;
  clans: number;
  projects: number;
  tokens: number;
  openReports: number;
  banned: number;
  newUsers24h: number;
  battles24h: number;
}

export default function AdminOverviewPage() {
  const q = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api<AdminStats>('/admin/stats'), refetchInterval: 60_000 });
  if (q.error) return <Empty title="Could not load stats" body={errorMessage(q.error)} action={<button className="btn-secondary" onClick={() => void q.refetch()}>Retry</button>} />;
  if (!q.data) return <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Loading…</div>;
  const s = q.data;
  const cards: Array<{ label: string; value: number; hint?: string; icon: typeof Users; href: string; accent?: string }> = [
    { label: 'Users', value: s.users, hint: `+${fmt(s.newUsers24h)} in the last 24h`, icon: Users, href: '/admin/users' },
    { label: 'Players', value: s.players, hint: 'with a village', icon: Castle, href: '/admin/villages' },
    { label: 'Battles', value: s.battles, hint: `${fmt(s.battles24h)} finished in the last 24h`, icon: Swords, href: '/admin/battles', accent: 'text-ember-300' },
    { label: 'Clans', value: s.clans, icon: UsersRound, href: '/admin/clans' },
    { label: 'Projects', value: s.projects, icon: Rocket, href: '/admin/projects' },
    { label: 'Tokens', value: s.tokens, hint: 'verified on-chain', icon: Coins, href: '/admin/tokens', accent: 'text-gold-300' },
    { label: 'Open reports', value: s.openReports, icon: Flag, href: '/admin/reports', accent: s.openReports > 0 ? 'text-amber-300' : undefined },
    { label: 'Banned users', value: s.banned, icon: Ban, href: '/admin/users', accent: s.banned > 0 ? 'text-rose-300' : undefined },
    { label: 'New users (24h)', value: s.newUsers24h, icon: UserPlus, href: '/admin/users', accent: 'text-mint-400' },
  ];
  return (
    <div>
      <PageHeader title="Overview" subtitle="Live platform counters. Refreshes every minute." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="stat flex items-center gap-3 transition hover:border-white/20">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-slate-300"><c.icon size={18} /></span>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">{c.label}</div>
              <div className={`font-display text-2xl font-bold ${c.accent ?? 'text-white'}`}>{fmt(c.value)}</div>
              {c.hint && <div className="text-xs text-slate-500">{c.hint}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
