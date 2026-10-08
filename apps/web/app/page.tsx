'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Castle, Coins, Rocket, Shield, Swords, Trophy, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { SOLANA_NETWORK, ROBINHOOD_CHAIN_NETWORK } from '@/lib/config';
import type { PlayerSummaryDTO, ProjectDTO, VillageDTO } from '@launch/types';
import { compact, fmtUsd } from '@/components/ui/primitives';

export default function HomePage() {
  const { user, ready } = useAuth();
  const me = useQuery({ queryKey: ['player-me'], queryFn: () => api<{ player: PlayerSummaryDTO }>('/game/player/me'), enabled: !!user?.playerId });
  const village = useQuery({ queryKey: ['village'], queryFn: () => api<{ village: VillageDTO }>('/game/village'), enabled: !!user?.playerId });
  const projects = useQuery({ queryKey: ['projects', 'home'], queryFn: () => api<{ items: ProjectDTO[] }>('/launchpad/projects?sort=new&limit=6') });
  const leaders = useQuery({ queryKey: ['leaders', 'home'], queryFn: () => api<{ items: Array<{ rank: number; id: string; name: string; trophies: number; level: number }> }>('/game/leaderboard/players?limit=5') });

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-ink-900 via-ink-900 to-ink-800 p-8 md:p-12">
        <div className="absolute inset-0 bg-grid-faint bg-[size:28px_28px] opacity-60" />
        <div className="relative max-w-2xl">
          <span className="badge border-ember-500/40 text-ember-300">Solana {SOLANA_NETWORK} · Robinhood Chain {ROBINHOOD_CHAIN_NETWORK}</span>
          <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight text-white md:text-5xl">Build your hold. Raid your rivals. Launch your token.</h1>
          <p className="mt-4 text-base text-slate-300">Emberhold is a persistent, server-authoritative strategy game: build a village, train an army, attack real players in real time and climb the ladder. Launch is a real token launchpad on Solana and Robinhood Chain: every launch is a transaction your own wallet signs, verified on chain before it is published.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {user?.playerId ? (
              <Link href="/village" className="btn-primary"><Castle size={16} /> Enter your village</Link>
            ) : (
              <Link href="/register" className="btn-primary"><Castle size={16} /> Play free</Link>
            )}
            <Link href="/launchpad" className="btn-secondary"><Rocket size={16} /> Launch a token</Link>
            <Link href="/projects" className="btn-ghost">Browse projects</Link>
          </div>
        </div>
      </section>

      {user?.playerId && me.data && village.data && (
        <section className="grid gap-3 md:grid-cols-4">
          <div className="stat"><div className="text-[11px] uppercase text-slate-500">Trophies</div><div className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-gold-400"><Trophy size={20} /> {me.data.player.trophies}</div></div>
          <div className="stat"><div className="text-[11px] uppercase text-slate-500">Level</div><div className="mt-1 font-display text-2xl font-bold text-white">{me.data.player.level}</div><div className="text-xs text-slate-500">Town Hall {village.data.village.townHallLevel}</div></div>
          <div className="stat"><div className="text-[11px] uppercase text-slate-500">Gold / Elixir</div><div className="mt-1 font-display text-xl font-bold"><span className="text-gold-400">{compact(village.data.village.resources.gold)}</span> <span className="text-slate-600">/</span> <span className="text-elixir-400">{compact(village.data.village.resources.elixir)}</span></div></div>
          <div className="stat"><div className="text-[11px] uppercase text-slate-500">Record</div><div className="mt-1 font-display text-xl font-bold text-white">{me.data.player.attacksWon}W · {me.data.player.attacksLost}L</div><div className="text-xs text-slate-500">defenses {me.data.player.defensesWon}W · {me.data.player.defensesLost}L</div></div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: Castle, title: 'Persistent village', body: 'Buildings, resources, timers and upgrades live in PostgreSQL. The client only sends intents; the server decides.' },
          { icon: Swords, title: 'Real-time raids', body: 'Battles run on the game server over WebSockets. Deploy troops tile by tile and watch the authoritative simulation.' },
          { icon: Shield, title: 'Clans', body: 'Create or join a clan, donate reinforcements, chat live and climb the clan rankings.' },
          { icon: Rocket, title: 'Token launchpad', body: 'Create a Token-2022 mint on Solana or an ERC-20 on Robinhood Chain. Your wallet signs; the server verifies on chain.' },
          { icon: Coins, title: 'Live market data', body: 'Project pages show real DexScreener and explorer data. When there is none yet, we say "Data unavailable".' },
          { icon: Wallet, title: 'Your wallets', body: 'Phantom, Solflare and EVM wallets. Sign-in is a signature, never a seed phrase. Balances are read from the chain.' },
        ].map((f) => (
          <div key={f.title} className="card p-5">
            <f.icon className="text-ember-400" size={22} />
            <div className="mt-3 font-display font-semibold text-white">{f.title}</div>
            <p className="mt-1 text-sm text-slate-400">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-bold text-white">Newest launches</h2><Link href="/projects" className="text-sm text-ember-300 hover:underline">All projects</Link></div>
          {projects.data?.items.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.data.items.map((p) => (
                <Link key={p.id} href={`/projects/${p.slug}`} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-ink-800/60 p-3 hover:bg-white/[0.05]">
                  {p.logoUrl ? <img src={p.logoUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-ember-500/20 font-bold text-ember-300">{p.symbol.slice(0, 2)}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-100">{p.name} <span className="text-slate-500">{p.symbol}</span></div>
                    <div className="text-xs text-slate-500">{p.chain === 'SOLANA' ? 'Solana' : 'Robinhood Chain'} · {p.token?.metrics?.priceUsd != null ? fmtUsd(p.token.metrics.priceUsd) : 'Price: Data unavailable'}</div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">{projects.isLoading ? 'Loading…' : 'No tokens have been launched yet. Be the first.'}</p>
          )}
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-bold text-white">Top players</h2><Link href="/leaderboard" className="text-sm text-ember-300 hover:underline">Leaderboard</Link></div>
          <ol className="space-y-2 text-sm">
            {leaders.data?.items.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"><span><span className="mr-2 text-slate-500">#{p.rank}</span>{p.name}</span><span className="flex items-center gap-1 text-gold-400"><Trophy size={12} /> {p.trophies}</span></li>
            ))}
          </ol>
        </div>
      </section>
      {!ready && null}
    </div>
  );
}
