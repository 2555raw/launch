'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Bell, Coins, Flame, Gem, Home, Settings, Shield, Store, Swords, Trophy, Users } from 'lucide-react';
import type { PlayerSummaryDTO, VillageDTO } from '@launch/types';
import { levelFromXp } from '@launch/game-engine';
import { api } from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { compact } from '@/components/ui/primitives';
import type { ReactNode } from 'react';

/** Resource bar with cap, drawn like a game HUD pill. */
export function ResourcePill({ icon, value, cap, color }: { icon: ReactNode; value: number; cap?: number; color: string }) {
  const pct = cap ? Math.min(100, (value / cap) * 100) : 0;
  return (
    <div className="relative flex min-w-[150px] items-center gap-2 rounded-full border border-black/40 bg-ink-950/85 py-1 pl-2 pr-3 shadow-lg backdrop-blur">
      <span className={`grid h-7 w-7 place-items-center rounded-full ${color} text-ink-950`}>{icon}</span>
      <div className="flex-1 leading-none">
        {cap !== undefined && <div className="text-[9px] text-slate-400">Max: {cap.toLocaleString()}</div>}
        <div className="font-display text-sm font-bold text-white">{value.toLocaleString()}</div>
        {cap !== undefined && (
          <div className="mt-0.5 h-1 overflow-hidden rounded bg-white/10">
            <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

export function RoundButton({ icon, label, onClick, href, badge, primary }: { icon: ReactNode; label: string; onClick?: () => void; href?: string; badge?: number; primary?: boolean }) {
  const cls = `relative grid h-14 w-14 place-items-center rounded-2xl border-2 shadow-lg transition active:scale-95 ${primary ? 'border-ember-300 bg-gradient-to-b from-ember-400 to-ember-600 text-ink-950' : 'border-black/50 bg-gradient-to-b from-ink-700 to-ink-900 text-slate-100 hover:from-ink-600'}`;
  const inner = (
    <>
      {icon}
      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-200">{label}</span>
      {badge ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{badge}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className={cls} aria-label={label}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={cls} aria-label={label}>
      {inner}
    </button>
  );
}

/** Top-left: level badge with XP ring, name and trophies. Top-right: resources. */
export function GameTopBar({ village, mode }: { village: VillageDTO | undefined; mode: 'village' | 'battle' }) {
  const me = useQuery({ queryKey: ['player-me'], queryFn: () => api<{ player: PlayerSummaryDTO }>('/game/player/me'), staleTime: 30_000 });
  const p = me.data?.player;
  const xp = p ? levelFromXp(p.xp) : null;
  const ring = xp ? (xp.xpIntoLevel / xp.xpToNext) * 100 : 0;
  const { unread } = useSocket();
  const res = village?.resources;
  return (
    <>
      <div className="pointer-events-auto absolute left-3 top-3 flex items-center gap-2">
        <div className="relative grid h-12 w-12 place-items-center rounded-full" style={{ background: `conic-gradient(#ffd04d ${ring}%, rgba(255,255,255,.12) 0)` }}>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-ink-950 font-display text-sm font-extrabold text-gold-300">{p?.level ?? '…'}</div>
        </div>
        <div className="rounded-xl border border-black/40 bg-ink-950/85 px-3 py-1.5 shadow-lg backdrop-blur">
          <div className="font-display text-sm font-bold text-white">{p?.name ?? '…'}</div>
          <div className="flex items-center gap-1 text-xs text-gold-300"><Trophy size={12} /> {p?.trophies ?? 0}{p?.clan ? <span className="ml-2 text-slate-400">[{p.clan.tag}]</span> : null}</div>
        </div>
        {mode === 'village' && (
          <Link href="/" className="grid h-9 w-9 place-items-center rounded-xl border border-black/40 bg-ink-950/85 text-slate-300 hover:text-white" aria-label="Back to site">
            <Home size={16} />
          </Link>
        )}
      </div>
      {res && (
        <div className="pointer-events-auto absolute right-3 top-3 flex flex-col items-end gap-1.5 sm:flex-row sm:items-start">
          <ResourcePill icon={<Coins size={14} />} value={res.gold} cap={res.goldCapacity} color="bg-gold-400" />
          <ResourcePill icon={<Flame size={14} />} value={res.elixir} cap={res.elixirCapacity} color="bg-elixir-500" />
          <ResourcePill icon={<Gem size={14} />} value={res.gems} color="bg-mint-400" />
          <Link href="/profile" className="relative grid h-9 w-9 place-items-center rounded-full border border-black/40 bg-ink-950/85 text-slate-200" aria-label="Notifications">
            <Bell size={16} />
            {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-ember-500 px-1 text-[10px] font-bold text-ink-950">{unread}</span>}
          </Link>
        </div>
      )}
    </>
  );
}

/** Bottom-left and bottom-right round buttons like a mobile strategy game. */
export function GameBottomBar({ onShop, extra }: { onShop?: () => void; extra?: ReactNode }) {
  const router = useRouter();
  return (
    <>
      <div className="pointer-events-auto absolute bottom-7 left-3 flex items-end gap-3">
        {onShop && <RoundButton icon={<Store size={22} />} label="Shop" onClick={onShop} primary />}
        <RoundButton icon={<Swords size={22} />} label="Attack" onClick={() => router.push('/attack')} />
        <RoundButton icon={<Shield size={22} />} label="Army" href="/army" />
        {extra}
      </div>
      <div className="pointer-events-auto absolute bottom-7 right-3 flex items-end gap-3">
        <RoundButton icon={<Users size={22} />} label="Clan" href="/clan" />
        <RoundButton icon={<Trophy size={22} />} label="Ranks" href="/leaderboard" />
        <RoundButton icon={<Settings size={22} />} label="Settings" href="/settings" />
      </div>
    </>
  );
}

export { compact };
