'use client';
import Link from 'next/link';
import { Castle, Shield, Swords, Trophy, Users } from 'lucide-react';
import { levelFromXp } from '@launch/game-engine';
import type { PlayerSummaryDTO } from '@launch/types';
import { useT } from '@/lib/i18n';
import { ROLE_LABEL } from '@/components/clan/roles';
import { ProgressBar } from '@/components/ui/progress';
import { Stat, fmt } from '@/components/ui/primitives';

export function PlayerStats({ player, linkClan = true }: { player: PlayerSummaryDTO; linkClan?: boolean }) {
  const t = useT();
  const xp = levelFromXp(player.xp);
  const winRate = (w: number, l: number) => (w + l > 0 ? t('{pct}% win rate', { pct: Math.round((w / (w + l)) * 100) }) : t('No battles yet'));
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="stat sm:col-span-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
          <span>{t('Level')}</span>
          <span className="font-mono normal-case">
            {fmt(xp.xpIntoLevel)} / {fmt(xp.xpToNext)} xp
          </span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold text-white">{player.level}</span>
          <span className="text-xs text-slate-500">{t('{n} total xp', { n: fmt(player.xp) })}</span>
        </div>
        <ProgressBar value={xp.xpIntoLevel} max={xp.xpToNext} color="ember" className="mt-2" />
      </div>
      <Stat label={t('Trophies')} value={<span className="flex items-center gap-1.5"><Trophy size={18} /> {fmt(player.trophies)}</span>} hint={t('Best {n}', { n: fmt(player.bestTrophies) })} accent="gold" />
      <Stat label={t('Town Hall')} value={<span className="flex items-center gap-1.5"><Castle size={18} /> {t('Level {n}', { n: player.townHallLevel })}</span>} accent="ember" />
      <Stat label={t('Attacks')} value={<span className="flex items-center gap-1.5"><Swords size={18} /> {fmt(player.attacksWon)} <span className="text-sm font-normal text-slate-500">{t('won · {n} lost', { n: fmt(player.attacksLost) })}</span></span>} hint={winRate(player.attacksWon, player.attacksLost)} />
      <Stat label={t('Defenses')} value={<span className="flex items-center gap-1.5"><Shield size={18} /> {fmt(player.defensesWon)} <span className="text-sm font-normal text-slate-500">{t('held · {n} lost', { n: fmt(player.defensesLost) })}</span></span>} hint={winRate(player.defensesWon, player.defensesLost)} accent="mint" />
      <div className="stat sm:col-span-2">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{t('Clan')}</div>
        {player.clan ? (
          <div className="mt-1 flex items-center gap-2">
            <Users size={18} className="text-elixir-400" />
            {linkClan ? (
              <Link href="/clan" className="font-display text-xl font-bold text-white hover:text-ember-300">
                {player.clan.name}
              </Link>
            ) : (
              <span className="font-display text-xl font-bold text-white">{player.clan.name}</span>
            )}
            <span className="font-mono text-xs text-slate-500">[{player.clan.tag}]</span>
            <span className="badge">{t(ROLE_LABEL[player.clan.role])}</span>
          </div>
        ) : (
          <div className="mt-1 font-display text-xl font-bold text-slate-500">{t('No clan')}</div>
        )}
      </div>
    </div>
  );
}
