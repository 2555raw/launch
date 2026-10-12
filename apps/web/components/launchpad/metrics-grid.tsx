'use client';
import type { TokenMetricsDTO } from '@launch/types';
import { fmt, fmtUsd } from '@/components/ui/primitives';
import { useT } from '@/lib/i18n';
import { ExtLink } from './common';

function Cell({ label, value, unavailable }: { label: string; value: string; unavailable: boolean }) {
  return (
    <div className="stat">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={unavailable ? 'mt-1 text-sm text-slate-500' : 'mt-1 font-display text-lg font-bold text-white'}>{value}</div>
    </div>
  );
}

export function MetricsSourceNote({ metrics }: { metrics: TokenMetricsDTO | null }) {
  const t = useT();
  if (metrics?.source === 'dexscreener') {
    return (
      <div className="text-xs text-slate-400">
        {t('Market data: DexScreener')}{metrics.dexId ? ` (${metrics.dexId})` : ''}
        {metrics.dexUrl && (
          <>
            {' · '}
            <ExtLink href={metrics.dexUrl}>{t('Open pair')}</ExtLink>
          </>
        )}
        {' · '}{t('updated {time}', { time: new Date(metrics.fetchedAt).toLocaleTimeString() })}
      </div>
    );
  }
  return <div className="text-xs text-slate-500">{t('No DEX pair indexed yet')}{metrics ? ` · ${t('checked {time}', { time: new Date(metrics.fetchedAt).toLocaleTimeString() })}` : ''}</div>;
}

export function MetricsGrid({ metrics }: { metrics: TokenMetricsDTO | null }) {
  const t = useT();
  const m = metrics;
  const usd = (v: number | null | undefined) => ({ value: fmtUsd(v), unavailable: v === null || v === undefined });
  const num = (v: number | null | undefined) => ({ value: fmt(v), unavailable: v === null || v === undefined });
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      <Cell label={t('Price (USD)')} {...usd(m?.priceUsd)} />
      <Cell label={t('Market cap')} {...usd(m?.marketCapUsd)} />
      <Cell label={t('FDV')} {...usd(m?.fdvUsd)} />
      <Cell label={t('Liquidity')} {...usd(m?.liquidityUsd)} />
      <Cell label={t('24h volume')} {...usd(m?.volume24hUsd)} />
      <Cell label={t('24h transactions')} {...num(m?.txns24h)} />
      <Cell label={t('Holders')} {...num(m?.holders)} />
    </div>
  );
}
