'use client';
import { BUILDING_DEFINITIONS, gemsToSkip, getBuildingLevel, maxBuildingLevel } from '@launch/game-engine';
import type { BuildingDTO, VillageDTO } from '@launch/types';
import { ArrowUpCircle, Coins, Flame, Gem, Move, Trash2, X, Zap } from 'lucide-react';
import { timeLeft } from '@/components/ui/primitives';
import { useI18n, useT } from '@/lib/i18n';
import { buildingDescription, buildingName, categoryLabel } from '@/lib/i18n/game-data';

function fmtSec(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(s % 3600 ? 1 : 0)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}

export function CostLine({ cost }: { cost: { gold?: number; elixir?: number; gems?: number } }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-2">
      {cost.gold ? <span className="inline-flex items-center gap-1 text-gold-400"><Coins size={12} /> {cost.gold.toLocaleString()}</span> : null}
      {cost.elixir ? <span className="inline-flex items-center gap-1 text-elixir-400"><Flame size={12} /> {cost.elixir.toLocaleString()}</span> : null}
      {cost.gems ? <span className="inline-flex items-center gap-1 text-mint-400"><Gem size={12} /> {cost.gems.toLocaleString()}</span> : null}
      {!cost.gold && !cost.elixir && !cost.gems ? <span className="text-slate-400">{t('Free')}</span> : null}
    </span>
  );
}

export function LevelStats({ type, level }: { type: string; level: number }) {
  const t = useT();
  const l = getBuildingLevel(type, level);
  if (!l) return null;
  const rows: Array<[string, string]> = [[t('Hitpoints'), l.hp.toLocaleString()]];
  if (l.productionPerHour) rows.push([t('Production'), t('{amount} / hour', { amount: l.productionPerHour.toLocaleString() })], [t('Capacity'), (l.collectorCapacity ?? 0).toLocaleString()]);
  if (l.storage?.gold) rows.push([t('Gold storage'), l.storage.gold.toLocaleString()]);
  if (l.storage?.elixir) rows.push([t('Elixir storage'), l.storage.elixir.toLocaleString()]);
  if (l.damage) rows.push([t('Damage'), t('{damage} every {seconds}s', { damage: l.damage, seconds: (l.attackSpeedMs ?? 1000) / 1000 })], [t('Range'), l.minRange ? t('{range} tiles (min {min})', { range: l.range ?? 0, min: l.minRange }) : t('{range} tiles', { range: l.range ?? 0 })], [t('Targets'), t(l.targets ?? 'ground')]);
  if (l.splashRadius) rows.push([t('Splash radius'), t('{range} tiles', { range: l.splashRadius })]);
  if (l.housing) rows.push([type === 'clan_hall' ? t('Reinforcement capacity') : t('Housing'), String(l.housing)]);
  if (l.tier) rows.push([type === 'barracks' ? t('Troop tier') : t('Research tier'), String(l.tier)]);
  if (l.gemsPerDay) rows.push([t('Crystals'), t('{amount} / day', { amount: l.gemsPerDay })]);
  if (l.builders) rows.push([t('Builders'), `+${l.builders}`]);
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {rows.map(([k, val]) => (
        <div key={k} className="contents">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-right text-slate-200">{val}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BuildingPanel(props: { building: BuildingDTO; village: VillageDTO; now: number; onMove: () => void; onUpgrade: () => void; onCollect: () => void; onCancel: () => void; onSkip: () => void; onRemove: () => void; busy: boolean }) {
  const { locale, t } = useI18n();
  const { building: b, village, now } = props;
  const def = BUILDING_DEFINITIONS[b.type];
  const next = getBuildingLevel(b.type, b.level + 1);
  const maxLvl = maxBuildingLevel(b.type, village.townHallLevel);
  const canUpgrade = !!next && b.state === 'IDLE' && (b.level + 1 <= maxLvl || (b.type === 'town_hall' && next.requiredTownHall <= village.townHallLevel));
  const affordable = !!next && (next.cost.gold ?? 0) <= village.resources.gold && (next.cost.elixir ?? 0) <= village.resources.elixir;
  const builderFree = village.builders.busy < village.builders.total || (next?.buildTimeSec ?? 0) === 0;
  const remainingMs = b.constructionEndsAt ? new Date(b.constructionEndsAt).getTime() - now : 0;
  const progress = b.constructionStartedAt && b.constructionEndsAt ? Math.min(1, (now - new Date(b.constructionStartedAt).getTime()) / (new Date(b.constructionEndsAt).getTime() - new Date(b.constructionStartedAt).getTime())) : 0;
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-lg font-bold text-white">{buildingName(locale, b.type, def?.name ?? b.type)}</div>
          <div className="text-xs text-slate-500">{t('Level {level}', { level: b.level })}{def?.levels.length ? ` / ${def.levels.length}` : ''} · {b.size}×{b.size}</div>
        </div>
        <span className="badge">{def?.category ? categoryLabel(locale, def.category, def.category) : def?.category}</span>
      </div>
      <p className="mt-2 text-xs text-slate-400">{def?.description ? buildingDescription(locale, b.type, def.description) : def?.description}</p>
      <div className="mt-3 rounded-xl border border-white/[0.06] bg-ink-800/60 p-3">
        <LevelStats type={b.type} level={b.level} />
      </div>
      {b.state !== 'IDLE' && (
        <div className="mt-3 rounded-xl border border-gold-500/20 bg-gold-500/5 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gold-300">{b.state === 'UPGRADING' ? t('Upgrading to level {level}', { level: b.level + 1 }) : t('Under construction')}</span>
            <span className="font-mono text-slate-200">{timeLeft(b.constructionEndsAt, now)}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full bg-gold-400" style={{ width: `${progress * 100}%` }} /></div>
          <div className="mt-2 flex gap-2">
            <button className="btn-secondary flex-1 py-1 text-xs" disabled={props.busy} onClick={props.onSkip}><Zap size={12} /> {t('Finish now')} · {gemsToSkip(remainingMs)} <Gem size={12} className="text-mint-400" /></button>
            <button className="btn-ghost py-1 text-xs" disabled={props.busy} onClick={props.onCancel}><X size={12} /> {t('Cancel')}</button>
          </div>
        </div>
      )}
      {b.accrued !== undefined && (
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-ink-800/60 p-3 text-xs">
          <div className="flex items-center justify-between"><span className="text-slate-400">{t('Ready to collect')}</span><span className="font-semibold text-slate-100">{b.accrued.toLocaleString()} / {(b.accruedCapacity ?? 0).toLocaleString()}</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full bg-mint-500" style={{ width: `${b.accruedCapacity ? (b.accrued / b.accruedCapacity) * 100 : 0}%` }} /></div>
          <button className="btn-primary mt-2 w-full py-1 text-xs" disabled={props.busy || b.accrued === 0} onClick={props.onCollect}>{t('Collect')}</button>
        </div>
      )}
      {next && (
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-ink-800/60 p-3 text-xs">
          <div className="mb-1 flex items-center justify-between"><span className="font-semibold text-slate-200">{t('Next level {level}', { level: b.level + 1 })}</span><span className="text-slate-500">{fmtSec(next.buildTimeSec)}</span></div>
          <LevelStats type={b.type} level={b.level + 1} />
          <div className="mt-2 flex items-center justify-between"><CostLine cost={next.cost} />{next.requiredTownHall > village.townHallLevel && <span className="text-rose-400">{t('Needs Town Hall {level}', { level: next.requiredTownHall })}</span>}</div>
          <button className="btn-primary mt-2 w-full py-1.5 text-xs" disabled={props.busy || !canUpgrade || !affordable || !builderFree} onClick={props.onUpgrade} title={!builderFree ? t('All builders are busy') : !affordable ? t('Not enough resources') : ''}>
            <ArrowUpCircle size={14} /> {!builderFree ? t('Builders busy') : !affordable ? t('Not enough resources') : t('Upgrade')}
          </button>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button className="btn-secondary flex-1 py-1.5 text-xs" onClick={props.onMove}><Move size={14} /> {t('Move')}</button>
        {b.type !== 'town_hall' && <button className="btn-ghost py-1.5 text-xs text-rose-300" disabled={props.busy || b.state !== 'IDLE'} onClick={props.onRemove}><Trash2 size={14} /> {t('Remove')}</button>}
      </div>
    </div>
  );
}
