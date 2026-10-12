'use client';
import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Search, ShieldAlert, X } from 'lucide-react';
import type { BattleState, DeploymentRecord } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { StatusBadge } from '@/components/admin/status-badge';
import { Stars } from '@/components/profile/battle-history';
import { fmtDate, signed } from '@/components/ui/dates';
import { Empty, PageHeader, Spinner, fmt } from '@/components/ui/primitives';
import { Table, Td, Th, Tr } from '@/components/ui/table';

interface BattleRow {
  id: string;
  state: BattleState;
  attacker: { id: string; name: string };
  defender: { id: string; name: string };
  stars: number;
  destructionPercent: number;
  lootGold: number;
  lootElixir: number;
  attackerTrophyDelta: number;
  createdAt: string;
  endedAt: string | null;
}
interface Audit {
  battle: { id: string; stars: number; destructionPercent: number; lootGold: number; lootElixir: number; deployments: DeploymentRecord[] };
  replayed: { stars: number; destructionPercent: number; lootGold: number; lootElixir: number } | null;
  matches: boolean | null;
}

function AuditPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const q = useQuery({ queryKey: ['admin', 'battle-audit', id], queryFn: () => api<Audit>(`/admin/battles/${id}/audit`) });
  return (
    <div className="card animate-rise mb-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-white">
          {t('Audit')} <span className="font-mono text-xs text-slate-500">{id}</span>
        </h2>
        <button className="btn-ghost p-1" onClick={onClose} aria-label={t('Close')}><X size={14} /></button>
      </div>
      {q.isLoading ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400"><Spinner /> {t('Re-simulating from seed and deployment log…')}</div>
      ) : q.error ? (
        <p className="mt-2 text-xs text-rose-300">{errorMessage(q.error)}</p>
      ) : q.data ? (
        q.data.replayed === null ? (
          <p className="mt-2 text-xs text-slate-400">{t('This battle has not finished; nothing to replay.')}</p>
        ) : (
          <div className="mt-3">
            <span className={`badge gap-1 ${q.data.matches ? 'border-mint-500/40 text-mint-400' : 'border-rose-500/40 text-rose-300'}`}>
              {q.data.matches ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />} {q.data.matches ? t('Replay matches recorded result') : t('Mismatch: recorded result differs from replay')}
            </span>
            <Table className="mt-3">
              <thead>
                <tr>
                  <Th>{t('Metric')}</Th>
                  <Th className="text-right">{t('Recorded')}</Th>
                  <Th className="text-right">{t('Replayed')}</Th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Stars', q.data.battle.stars, q.data.replayed.stars],
                    ['Destruction %', q.data.battle.destructionPercent, q.data.replayed.destructionPercent],
                    ['Loot gold', q.data.battle.lootGold, q.data.replayed.lootGold],
                    ['Loot elixir', q.data.battle.lootElixir, q.data.replayed.lootElixir],
                  ] as const
                ).map(([label, a, b]) => (
                  <Tr key={label}>
                    <Td className="text-xs text-slate-400">{t(label)}</Td>
                    <Td className="text-right font-mono">{fmt(a)}</Td>
                    <Td className={`text-right font-mono ${a === b ? '' : 'text-rose-300'}`}>{fmt(b)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <p className="mt-2 text-[11px] text-slate-500">{t('{n} deployments replayed.', { n: q.data.battle.deployments.length })}</p>
          </div>
        )
      ) : null}
    </div>
  );
}

export default function AdminBattlesPage() {
  const t = useT();
  const [playerInput, setPlayerInput] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [auditId, setAuditId] = useState<string | null>(null);
  const q = useInfiniteQuery({
    queryKey: ['admin', 'battles', playerId],
    queryFn: ({ pageParam }) => api<{ items: BattleRow[]; nextCursor: string | null }>(`/admin/battles?limit=50${playerId ? `&playerId=${encodeURIComponent(playerId)}` : ''}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      <PageHeader
        title={t('Battles')}
        subtitle={t('Most recent battles first. Audit re-simulates a finished battle server-side.')}
        actions={
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPlayerId(playerInput.trim());
            }}
          >
            <div className="relative w-64">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input pl-8 font-mono" placeholder={t('Filter by player id')} value={playerInput} onChange={(e) => setPlayerInput(e.target.value)} />
            </div>
            <button type="submit" className="btn-secondary">{t('Filter')}</button>
          </form>
        }
      />
      {auditId && <AuditPanel id={auditId} onClose={() => setAuditId(null)} />}
      {q.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> {t('Loading battles…')}</div>
      ) : q.error ? (
        <Empty title={t('Could not load battles')} body={errorMessage(q.error)} action={<button className="btn-secondary" onClick={() => void q.refetch()}>{t('Retry')}</button>} />
      ) : rows.length === 0 ? (
        <Empty title={t('No battles')} />
      ) : (
        <div className="card p-2 sm:p-4">
          <Table>
            <thead>
              <tr>
                <Th>{t('When')}</Th>
                <Th>{t('Attacker')}</Th>
                <Th>{t('Defender')}</Th>
                <Th>{t('State')}</Th>
                <Th>{t('Result')}</Th>
                <Th className="text-right">{t('Loot')}</Th>
                <Th className="text-right">{t('Δ trophies')}</Th>
                <Th className="text-right">{t('Audit')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <Tr key={b.id} highlight={b.id === auditId}>
                  <Td className="text-xs text-slate-400">
                    {fmtDate(b.endedAt ?? b.createdAt)}
                    <div className="font-mono text-[10px] text-slate-600">{b.id}</div>
                  </Td>
                  <Td className="font-semibold text-slate-100">{b.attacker.name}</Td>
                  <Td className="font-semibold text-slate-100">{b.defender.name}</Td>
                  <Td><StatusBadge value={b.state} /></Td>
                  <Td>
                    <div className="flex items-center gap-2 text-xs"><Stars n={b.stars} /> {b.destructionPercent}%</div>
                  </Td>
                  <Td className="text-right font-mono text-xs">
                    <span className="text-gold-300">{fmt(b.lootGold)}</span> / <span className="text-elixir-400">{fmt(b.lootElixir)}</span>
                  </Td>
                  <Td className={`text-right font-mono ${b.attackerTrophyDelta >= 0 ? 'text-mint-400' : 'text-rose-300'}`}>{signed(b.attackerTrophyDelta)}</Td>
                  <Td className="text-right">
                    <button className="btn-secondary px-2 py-1 text-xs" onClick={() => setAuditId(b.id)} disabled={b.state !== 'FINISHED'} title={b.state !== 'FINISHED' ? t('Only finished battles can be audited') : undefined}>
                      {t('Audit')}
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {q.hasNextPage && (
            <div className="mt-3 text-center">
              <button className="btn-secondary" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                {q.isFetchingNextPage ? <Spinner /> : null} {t('Load more')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
