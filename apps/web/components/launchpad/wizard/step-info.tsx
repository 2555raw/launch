'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Chain, ProjectDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/primitives';
import { Field, formatWhole } from '../common';
import { defaultDecimals, maxDecimals } from './state';

interface FormState {
  name: string;
  symbol: string;
  description: string;
  website: string;
  twitter: string;
  discord: string;
  telegram: string;
  totalSupply: string;
  decimals: number;
}

function fromProject(p: ProjectDTO | null, chain: Chain): FormState {
  return {
    name: p?.name ?? '',
    symbol: p?.symbol ?? '',
    description: p?.description ?? '',
    website: p?.website ?? '',
    twitter: p?.twitter ?? '',
    discord: p?.discord ?? '',
    telegram: p?.telegram ?? '',
    totalSupply: p?.totalSupply ?? '1000000000',
    decimals: p?.decimals ?? defaultDecimals(chain),
  };
}

const URL_RE = /^https?:\/\/.+/i;

function validate(f: FormState, chain: Chain): Partial<Record<keyof FormState, string>> {
  const e: Partial<Record<keyof FormState, string>> = {};
  if (!f.name.trim()) e.name = 'Required';
  else if (f.name.length > 32) e.name = 'Max 32 characters';
  if (!f.symbol) e.symbol = 'Required';
  else if (!/^[A-Z0-9]{1,10}$/.test(f.symbol)) e.symbol = 'Letters and digits only, max 10';
  if (f.description.length > 2000) e.description = 'Max 2000 characters';
  for (const k of ['website', 'twitter', 'discord', 'telegram'] as const) if (f[k] && !URL_RE.test(f[k])) e[k] = 'Must be a full URL (https://…)';
  if (!/^\d{1,30}$/.test(f.totalSupply)) e.totalSupply = 'Whole number of tokens, digits only';
  else if (BigInt(f.totalSupply) <= 0n) e.totalSupply = 'Must be positive';
  else if (chain === 'SOLANA' && BigInt(f.totalSupply) * 10n ** BigInt(f.decimals) > (1n << 64n) - 1n) e.totalSupply = 'Supply × 10^decimals exceeds the SPL u64 limit';
  if (!Number.isInteger(f.decimals) || f.decimals < 0 || f.decimals > maxDecimals(chain)) e.decimals = `0 – ${maxDecimals(chain)}`;
  return e;
}

export function StepInfo({
  chain,
  project,
  fixedSupply,
  revokeFreeze,
  onFlags,
  onSaved,
  onBack,
}: {
  chain: Chain;
  project: ProjectDTO | null;
  fixedSupply: boolean;
  revokeFreeze: boolean;
  onFlags: (f: { fixedSupply?: boolean; revokeFreeze?: boolean }) => void;
  onSaved: (p: ProjectDTO) => void;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => fromProject(project, chain));
  const [touched, setTouched] = useState(false);
  const errors = validate(form, chain);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        symbol: form.symbol,
        description: form.description,
        website: form.website || undefined,
        twitter: form.twitter || undefined,
        discord: form.discord || undefined,
        telegram: form.telegram || undefined,
        chain,
        totalSupply: form.totalSupply,
        decimals: form.decimals,
      };
      if (project) return (await api<{ project: ProjectDTO }>(`/launchpad/projects/${project.id}`, { method: 'PATCH', json: body })).project;
      return (await api<{ project: ProjectDTO }>('/launchpad/projects', { method: 'POST', json: body })).project;
    },
    onSuccess: (p) => {
      qc.setQueryData(['project', p.id], (old: { project: ProjectDTO; transactions: unknown[] } | undefined) => ({ project: p, transactions: old?.transactions ?? [] }));
      void qc.invalidateQueries({ queryKey: ['launchpad', 'mine'] });
      toast.success(project ? 'Draft updated' : 'Draft created');
      onSaved(p);
    },
    onError: (e) => toast.error('Could not save project', errorMessage(e)),
  });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length) return;
    save.mutate();
  };
  const err = (k: keyof FormState) => (touched ? errors[k] : undefined);

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">Token information</h2>
        <p className="mt-1 text-sm text-slate-400">Name, symbol and supply are written on chain and cannot be changed after launch.</p>
      </div>

      <div className="card grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Name" error={err('name')} hint={`${form.name.length}/32`}>
          <input className="input" value={form.name} maxLength={32} onChange={(e) => set('name', e.target.value)} placeholder="Ember Coin" />
        </Field>
        <Field label="Symbol" error={err('symbol')} hint="Uppercase, max 10">
          <input className="input font-mono uppercase" value={form.symbol} maxLength={10} onChange={(e) => set('symbol', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="EMBER" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description" error={err('description')} hint={`${form.description.length}/2000 · included in the off-chain metadata`}>
            <textarea className="input min-h-24" value={form.description} maxLength={2000} onChange={(e) => set('description', e.target.value)} placeholder="What is this token for?" />
          </Field>
        </div>
        <Field label="Website" error={err('website')}>
          <input className="input" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
        </Field>
        <Field label="X / Twitter" error={err('twitter')}>
          <input className="input" value={form.twitter} onChange={(e) => set('twitter', e.target.value)} placeholder="https://x.com/…" />
        </Field>
        <Field label="Discord" error={err('discord')}>
          <input className="input" value={form.discord} onChange={(e) => set('discord', e.target.value)} placeholder="https://discord.gg/…" />
        </Field>
        <Field label="Telegram" error={err('telegram')}>
          <input className="input" value={form.telegram} onChange={(e) => set('telegram', e.target.value)} placeholder="https://t.me/…" />
        </Field>
      </div>

      <div className="card grid gap-4 p-4 sm:grid-cols-2">
        <Field label="Total supply (whole tokens)" error={err('totalSupply')} hint={/^\d+$/.test(form.totalSupply) ? `${formatWhole(form.totalSupply)} ${form.symbol || 'tokens'}` : undefined}>
          <input className="input font-mono" inputMode="numeric" value={form.totalSupply} onChange={(e) => set('totalSupply', e.target.value.replace(/\D/g, ''))} placeholder="1000000000" />
        </Field>
        <Field label="Decimals" error={err('decimals')} hint={chain === 'SOLANA' ? '0 – 9 (default 9)' : '0 – 18 (default 18)'}>
          <input className="input font-mono" type="number" min={0} max={maxDecimals(chain)} value={form.decimals} onChange={(e) => set('decimals', Number(e.target.value))} />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:col-span-2">
          <input type="checkbox" className="mt-0.5 accent-ember-500" checked={fixedSupply} onChange={(e) => onFlags({ fixedSupply: e.target.checked })} />
          <span>
            <span className="block text-sm font-medium text-slate-100">Fixed supply</span>
            <span className="block text-xs text-slate-400">{chain === 'SOLANA' ? 'Revokes the mint authority in the creation transaction: no more tokens can ever be minted.' : 'Disables minting in the constructor: the contract owner cannot mint additional tokens.'}</span>
          </span>
        </label>
        {chain === 'SOLANA' && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:col-span-2">
            <input type="checkbox" className="mt-0.5 accent-ember-500" checked={revokeFreeze} onChange={(e) => onFlags({ revokeFreeze: e.target.checked })} />
            <span>
              <span className="block text-sm font-medium text-slate-100">Revoke freeze authority</span>
              <span className="block text-xs text-slate-400">Nobody (including you) will be able to freeze holders&apos; token accounts. Recommended for community tokens.</span>
            </span>
          </label>
        )}
      </div>

      <div className="flex justify-between">
        <button type="button" className="btn-ghost" onClick={onBack}>
          Back
        </button>
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending && <Spinner />} {project ? 'Save & continue' : 'Create draft & continue'}
        </button>
      </div>
    </form>
  );
}
