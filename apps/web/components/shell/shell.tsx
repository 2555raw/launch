'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, Castle, Coins, Flame, Gem, LayoutDashboard, LogOut, Menu, Rocket, Settings, Shield, Swords, Trophy, User, Users, Wallet, Wrench, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useSocket } from '@/lib/socket';
import type { NotificationDTO, VillageDTO } from '@launch/types';
import { compact } from '@/components/ui/primitives';
import { SiteFooter } from './footer';

const GAME_ROUTES = ['/village', '/attack'];

const GAME_NAV = [
  { href: '/village', label: 'Village', icon: Castle },
  { href: '/attack', label: 'Attack', icon: Swords },
  { href: '/army', label: 'Army', icon: Shield },
  { href: '/clan', label: 'Clan', icon: Users },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/profile', label: 'Profile', icon: User },
];
const WEB3_NAV = [
  { href: '/launchpad', label: 'Launchpad', icon: Rocket },
  { href: '/projects', label: 'Token Projects', icon: Flame },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/portfolio', label: 'Portfolio', icon: Coins },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, ready, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const socket = useSocket();
  const isStaff = user && ['ADMIN', 'MODERATOR', 'DEVELOPER'].includes(user.role);

  useEffect(() => {
    if (user?.playerId) socket.connect();
    else socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  useEffect(() => setOpen(false), [pathname]);

  const village = useQuery({ queryKey: ['village'], queryFn: () => api<{ village: VillageDTO }>('/game/village'), enabled: !!user?.playerId, refetchInterval: 30_000 });
  const res = village.data?.village.resources;
  const gameMode = GAME_ROUTES.some((r) => pathname.startsWith(r));
  if (gameMode) return <>{children}</>;

  const NavList = ({ items }: { items: typeof GAME_NAV }) => (
    <ul className="space-y-0.5">
      {items.map((n) => (
        <li key={n.href}>
          <Link href={n.href} className={clsx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition', pathname.startsWith(n.href) ? 'bg-ember-500/15 text-ember-300' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100')}>
            <n.icon size={16} /> {n.label}
          </Link>
        </li>
      ))}
    </ul>
  );

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-r border-white/[0.06] bg-ink-900/90 p-4 backdrop-blur">
      <Link href="/" className="mb-6 flex items-center gap-2 px-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-ember-400 to-elixir-500 font-display text-lg font-extrabold text-ink-950">L</span>
        <div>
          <div className="font-display text-base font-bold leading-tight text-white">Launch</div>
          <div className="text-[11px] text-slate-500">Emberhold · Launchpad</div>
        </div>
      </Link>
      <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Game</div>
      <NavList items={GAME_NAV} />
      <div className="mb-2 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Web3</div>
      <NavList items={WEB3_NAV} />
      {isStaff && (
        <>
          <div className="mb-2 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Staff</div>
          <NavList items={[{ href: '/admin', label: 'Admin', icon: Wrench }]} />
        </>
      )}
      <div className="mt-auto pt-4">
        {user ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <div className="truncate text-sm font-semibold text-slate-100">{user.username}</div>
            <div className="text-[11px] text-slate-500">{user.role.toLowerCase()}</div>
            <button onClick={() => void logout()} className="btn-ghost mt-2 w-full justify-start px-2 py-1 text-xs">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        ) : ready ? (
          <Link href="/login" className="btn-primary w-full">
            Sign in
          </Link>
        ) : null}
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="h-full">{sidebar}</div>
          <button className="flex-1 bg-black/60" onClick={() => setOpen(false)} aria-label="Close menu" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-ink-950/80 px-4 backdrop-blur">
          <button className="btn-ghost p-2 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          {res && (
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="badge gap-1 border-gold-500/30 text-gold-300"><Coins size={12} /> {compact(res.gold)} <span className="text-slate-500">/ {compact(res.goldCapacity)}</span></span>
              <span className="badge gap-1 border-elixir-500/30 text-elixir-400"><Flame size={12} /> {compact(res.elixir)} <span className="text-slate-500">/ {compact(res.elixirCapacity)}</span></span>
              <span className="badge gap-1 border-mint-500/30 text-mint-400"><Gem size={12} /> {res.gems}</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {user?.playerId && <NotificationBell />}
            <span className={clsx('hidden h-2 w-2 rounded-full sm:block', socket.status === 'authed' ? 'bg-mint-500' : 'bg-slate-600')} title={`Realtime: ${socket.status}`} />
            {!user && ready && (
              <Link href="/register" className="btn-primary hidden sm:inline-flex">
                Play free
              </Link>
            )}
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unread, setNotifications } = useSocket();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ notifications: NotificationDTO[]; unread: number }>('/game/notifications'), refetchInterval: 60_000 });
  useEffect(() => {
    if (q.data) setNotifications(q.data.notifications, q.data.unread);
  }, [q.data, setNotifications]);
  const markRead = async () => {
    await api('/game/notifications/read', { method: 'POST', json: {} });
    setNotifications(notifications.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })), 0);
  };
  return (
    <div className="relative">
      <button className="btn-ghost relative p-2" onClick={() => { setOpen((o) => !o); if (!open && unread) void markRead(); }} aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-ember-500 px-1 text-[10px] font-bold text-ink-950">{unread}</span>}
      </button>
      {open && (
        <div className="card absolute right-0 mt-2 w-80 p-2">
          <div className="px-2 py-1 text-xs font-semibold uppercase text-slate-500">Notifications</div>
          <div className="scroll-thin max-h-80 overflow-y-auto">
            {notifications.length === 0 && <div className="px-2 py-4 text-sm text-slate-500">Nothing yet.</div>}
            {notifications.map((n) => (
              <div key={n.id} className="rounded-lg px-2 py-2 text-sm hover:bg-white/[0.04]">
                <div className="font-medium text-slate-100">{n.title}</div>
                <div className="text-xs text-slate-400">{n.body}</div>
                <div className="mt-0.5 text-[10px] text-slate-600">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { LayoutDashboard };
