'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Castle, Coins, Flame, Gem, Gift, Search } from 'lucide-react';
import type { ResourceType, VillageDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useT } from '@/lib/i18n';
import { can } from '@/components/admin/permissions';
import { fmtDate, signed } from '@/components/ui/dates';
import { Empty, PageHeader, Spinner, Stat, fmt, timeLeft } from '@/components/ui/primitives';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

interface AdminPlayer {
  id: string;
  userId: string;
  name: string;
  xp: number;
  level: number;
  trophies: number;
  bestTrophies: number;
  gold: number;
  elixir: number;
  gems: number;
  attacksWon: number;
  attacksLost: number;
  defensesWon: number;
  defensesLost: number;
  shieldUntil: string | null;
  lastSeenAt: string;
  createdAt: string;
  user: { id: string; username: string; email: string | null };
}
interface LedgerRow {
  id: string;
  resource: ResourceType;
  delta: number;
  balanceAfter: number;
  reason: string;
  refId: string | null;
  createdAt: string;
}
interface VillageResponse {
  player: AdminPlayer;
  village: VillageDTO;
  ledger: LedgerRow[];
}

const RESOURCE_TONE: Record<ResourceType, string> = { GOLD: 'text-gold-300', ELIXIR: 'text-elixir-400', GEMS: 'text-mint-400' };

function GrantForm({ playerId }: { playerId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const [resource, setResource] = useState<ResourceType>('GOLD');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const grant = useMutation({
    mutationFn: () => api<{ village: VillageDTO }>(`/admin/villages/${playerId}/grant`, { method: 'POST', json: { resource, amount: Number(amount), reason: reason.trim() } }),
    onSuccess: () => {
      toast.success(t('Resources granted'), `${signed(Number(amount))} ${t(resource.toLowerCase())}`);
      setAmount('');
      setReason('');
      void qc.invalidateQueries({ queryKey: ['admin', 'village', playerId] });
    },
    onError: (e) => toast.error(t('Grant failed'), errorMessage(e)),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isInteger(n) || n === 0 || Math.abs(n) > 1_000_000) return toast.error(t('Invalid amount'), t('Whole number between -1,000,000 and 1,000,000.'));
    if (reason.trim().length < 3) return toast.error(t('Reason required'));
    if (window.confirm(t('Apply {amount} {resource} to this player?', { amount: signed(n), resource: t(resource) }))) grant.mutate();
  };
  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3 p-4">
      <div className="flex items-center gap-2 font-display text-sm font-semibold text-white"><Gift size={16} className="text-mint-400" /> {t('Grant resources')}</div>
      <div>
        <label className="label">{t('Resource')}</label>
        <select className="input w-auto" value={resource} onChange={(e) => setResource(e.target.value as ResourceType)}>
          <option value="GOLD">{t('Gold')}</option>
          <option value="ELIXIR">{t('Elixir')}</option>
          <option value="GEMS">{t('Gems')}</option>
        </select>
      </div>
      <div>
        <label className="label">{t('Amount (negative to remove)')}</label>
        <input className="input w-40 font-mono" type="number" step={1} min={-1000000} max={1000000} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="min-w-[200px] flex-1">
        <label className="label">{t('Reason (audited)')}</label>
        <input className="input" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder={t('e.g. compensation for outage #123')} />
      </div>
      <button type="submit" className="btn-primary" disabled={grant.isPending}>
        {grant.isPending ? <Spinner /> : <Gift size={16} />} {t('Grant')}
      </button>
    </form>
  );
}

function VillageInspector() {
  const t = useT();
  const me = useAuth((s) => s.user);
  const params = useSearchParams();
  const [input, setInput] = useState(params.get('playerId') ?? '');
  const [playerId, setPlayerId] = useState(params.get('playerId') ?? '');
  const q = useQuery({ queryKey: ['admin', 'village', playerId], queryFn: () => api<VillageResponse>(`/admin/villages/${playerId}`), enabled: !!playerId });

  return (
    <div className="space-y-4">
      <PageHeader title={t('Villages')} subtitle={t("Inspect any player's village, resources and ledger by player id.")} />
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPlayerId(input.trim());
        }}
      >
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-8 font-mono" placeholder={t('Player id (from the Users page)')} value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={!input.trim()}>
          {t('Load')}
        </button>
      </form>

      {!playerId ? (
        <Empty title={t('Enter a player id')} body={t('Pick a player from the Users page or paste an id above.')} />
      ) : q.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> {t('Loading village…')}</div>
      ) : q.error ? (
        <Empty title={t('Could not load village')} body={errorMessage(q.error)} />
      ) : q.data ? (
        <>
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-ember-500/15 text-ember-300"><Castle size={20} /></span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg font-bold text-white">
                  {q.data.player.name} <span className="text-sm font-normal text-slate-500">· {q.data.village.name}</span>
                </div>
                <div className="text-xs text-slate-400">
                  {t('User')} <span className="text-slate-200">{q.data.player.user.username}</span> ({q.data.player.user.email ?? t('wallet-only')}) · {t('player')} <span className="font-mono">{q.data.player.id}</span> · {t('user')} <span className="font-mono">{q.data.player.userId}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {t('Created {date}', { date: fmtDate(q.data.player.createdAt) })} · {t('last seen {date}', { date: fmtDate(q.data.player.lastSeenAt) })} · {t('shield {value}', { value: q.data.village.shieldUntil ? timeLeft(q.data.village.shieldUntil) : t('none') })}
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t('Town Hall')} value={t('Level {n}', { n: q.data.village.townHallLevel })} hint={t('{buildings} buildings · {busy}/{total} builders busy', { buildings: q.data.village.buildings.length, busy: q.data.village.builders.busy, total: q.data.village.builders.total })} accent="ember" />
            <Stat label={t('Gold')} value={<span className="flex items-center gap-1.5"><Coins size={16} /> {fmt(q.data.village.resources.gold)}</span>} hint={t('cap {n}', { n: fmt(q.data.village.resources.goldCapacity) })} accent="gold" />
            <Stat label={t('Elixir')} value={<span className="flex items-center gap-1.5"><Flame size={16} /> {fmt(q.data.village.resources.elixir)}</span>} hint={t('cap {n}', { n: fmt(q.data.village.resources.elixirCapacity) })} accent="elixir" />
            <Stat label={t('Gems')} value={<span className="flex items-center gap-1.5"><Gem size={16} /> {fmt(q.data.village.resources.gems)}</span>} hint={t('lvl {level} · {trophies} trophies', { level: q.data.player.level, trophies: fmt(q.data.player.trophies) })} accent="mint" />
          </div>
          {can(me?.role, 'grant') && <GrantForm playerId={playerId} />}
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-white">{t('Resource ledger')}</h2>
              <span className="badge">{t('last {n}', { n: q.data.ledger.length })}</span>
            </div>
            {q.data.ledger.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">{t('No ledger entries.')}</p>
            ) : (
              <Table className="mt-3">
                <thead>
                  <tr>
                    <Th>{t('When')}</Th>
                    <Th>{t('Resource')}</Th>
                    <Th className="text-right">{t('Delta')}</Th>
                    <Th className="text-right">{t('Balance after')}</Th>
                    <Th>{t('Reason')}</Th>
                    <Th>{t('Ref')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.ledger.map((l) => (
                    <Tr key={l.id}>
                      <Td className="text-xs text-slate-400">{fmtDate(l.createdAt)}</Td>
                      <Td className={`text-xs font-semibold ${RESOURCE_TONE[l.resource]}`}>{t(l.resource)}</Td>
                      <Td className={`text-right font-mono ${l.delta >= 0 ? 'text-mint-400' : 'text-rose-300'}`}>{signed(l.delta)}</Td>
                      <Td className="text-right font-mono">{fmt(l.balanceAfter)}</Td>
                      <Td className="font-mono text-xs">{l.reason}</Td>
                      <Td className="font-mono text-[11px] text-slate-500">{l.refId ?? '—'}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function AdminVillagesPage() {
  const t = useT();
  return (
    <Suspense fallback={<div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> {t('Loading…')}</div>}>
      <VillageInspector />
    </Suspense>
  );
}
