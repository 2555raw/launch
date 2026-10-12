'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, KeyRound, Plug, Unplug, XCircle } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { toast } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/primitives';
import { CopyButton, ExtLink, Field, SectionTitle } from '@/components/launchpad/common';
import type { RhAccount, RhCapabilities, RhConnection } from './robinhood-types';

export function RobinhoodCapabilities() {
  const t = useT();
  const q = useQuery({ queryKey: ['robinhood', 'capabilities'], queryFn: () => api<RhCapabilities>('/robinhood/capabilities') });
  return (
    <div className="card p-4">
      <h3 className="font-display font-semibold text-white">{t('What is supported')}</h3>
      <p className="mt-1 text-xs text-slate-500">{t('We only integrate official, documented Robinhood APIs. Features without a public API are listed as not implemented rather than simulated.')}</p>
      {q.isLoading ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> {t('Loading…')}
        </div>
      ) : q.isError ? (
        <div className="mt-3 text-sm text-rose-300">{errorMessage(q.error)}</div>
      ) : (
        <ul className="mt-3 divide-y divide-white/[0.05]">
          {q.data?.capabilities.map((c) => (
            <li key={c.name} className="flex items-start gap-3 py-2.5">
              {c.available ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-mint-400" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-rose-400" />}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-100">
                  {c.name}
                  <span className={`badge ${c.available ? 'border-mint-500/40 text-mint-400' : 'border-rose-500/40 text-rose-300'}`}>{c.available ? t('Available') : t('Not implemented')}</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {c.reason}
                  {c.docs && (
                    <>
                      {' '}
                      <ExtLink href={c.docs}>{t('Docs')}</ExtLink>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {q.data && <div className="mt-2 text-[11px] text-slate-600">{t('API base:')} {q.data.apiBaseUrl}</div>}
    </div>
  );
}

export function RobinhoodConnection() {
  const t = useT();
  const qc = useQueryClient();
  const conn = useQuery({ queryKey: ['robinhood', 'connection'], queryFn: () => api<{ connection: RhConnection | null }>('/robinhood/connection') });
  const [keys, setKeys] = useState<{ publicKeyBase64: string; privateKeyBase64: string } | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [label, setLabel] = useState('');
  const [account, setAccount] = useState<RhAccount | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['robinhood'] });
    void qc.invalidateQueries({ queryKey: ['portfolio'] });
  };

  const keypair = useMutation({
    mutationFn: () => api<{ publicKeyBase64: string; privateKeyBase64: string }>('/robinhood/keypair', { method: 'POST' }),
    onSuccess: (k) => {
      setKeys(k);
      setPrivateKey(k.privateKeyBase64);
    },
    onError: (e) => toast.error(t('Could not generate key pair'), errorMessage(e)),
  });
  const connect = useMutation({
    mutationFn: () => api<{ ok: boolean; account: RhAccount }>('/robinhood/connection', { method: 'POST', json: { apiKey: apiKey.trim(), privateKeyBase64: privateKey.trim(), label: label.trim() || undefined } }),
    onSuccess: (r) => {
      setAccount(r.account);
      setApiKey('');
      setPrivateKey('');
      setKeys(null);
      invalidate();
      toast.success(t('Robinhood connected'), t('Account {number} verified.', { number: r.account.account_number }));
    },
    onError: (e) => toast.error(t('Connection failed'), errorMessage(e)),
  });
  const disconnect = useMutation({
    mutationFn: () => api('/robinhood/connection', { method: 'DELETE' }),
    onSuccess: () => {
      setAccount(null);
      invalidate();
      toast.success(t('Robinhood disconnected'), t('Credentials deleted from our database.'));
    },
    onError: (e) => toast.error(t('Could not disconnect'), errorMessage(e)),
  });

  const c = conn.data?.connection ?? null;

  return (
    <div className="card p-4">
      <SectionTitle>{t('Connection')}</SectionTitle>
      {conn.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> {t('Loading…')}
        </div>
      ) : c ? (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-mint-400">
            <Plug size={16} /> {t('Connected')}{c.label ? ` · ${c.label}` : ''}
          </div>
          <div className="grid gap-1 text-xs text-slate-400">
            <div>
              {t('Public key:')} <span className="break-all font-mono text-slate-300">{c.publicKeyBase64}</span>
            </div>
            <div>{t('Linked {time}', { time: new Date(c.createdAt).toLocaleString() })}</div>
            <div>{t('Last verified {time}', { time: c.lastVerifiedAt ? new Date(c.lastVerifiedAt).toLocaleString() : t('never') })}</div>
          </div>
          {account && (
            <div className="text-xs text-slate-400">
              {t('Account {number}', { number: account.account_number })} · {account.status} · {t('buying power {amount}', { amount: `${account.buying_power} ${account.buying_power_currency}` })}
            </div>
          )}
          <button className="btn-danger text-xs" disabled={disconnect.isPending} onClick={() => confirm(t('Disconnect Robinhood? Your API key and private key will be deleted from our database.')) && disconnect.mutate()}>
            {disconnect.isPending ? <Spinner /> : <Unplug size={14} />} {t('Disconnect')}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
            <li>{t('Generate an Ed25519 key pair below (or bring your own).')}</li>
            <li>
              {t('Register the')} <span className="text-white">{t('public key')}</span> {t('at')} <ExtLink href="https://robinhood.com/account/crypto">robinhood.com/account/crypto</ExtLink> {t('to get an API key.')}
            </li>
            <li>{t('Paste the API key and the private key here. We verify them against your account, then store them encrypted.')}</li>
          </ol>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium text-slate-100">{t('Key pair')}</div>
              <button className="btn-secondary text-xs" disabled={keypair.isPending} onClick={() => keypair.mutate()}>
                {keypair.isPending ? <Spinner /> : <KeyRound size={14} />} {t('Generate key pair')}
              </button>
            </div>
            {keys && (
              <div className="mt-3 space-y-3 text-xs">
                <div>
                  <div className="label">{t('Public key (paste into Robinhood)')}</div>
                  <div className="flex items-center gap-1 rounded-lg bg-ink-800/80 p-2 font-mono text-slate-200">
                    <span className="break-all">{keys.publicKeyBase64}</span>
                    <CopyButton value={keys.publicKeyBase64} />
                  </div>
                </div>
                <div>
                  <div className="label">{t('Private key (shown once)')}</div>
                  <div className="flex items-center gap-1 rounded-lg bg-ink-800/80 p-2 font-mono text-slate-200">
                    <span className="break-all">{keys.privateKeyBase64}</span>
                    <CopyButton value={keys.privateKeyBase64} />
                  </div>
                  <div className="mt-2 flex items-start gap-2 text-gold-300">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{t('Copy it now and store it safely. It is generated in memory and not stored anywhere; we only ever see it if you choose to link it below.')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              connect.mutate();
            }}
          >
            <Field label={t('API key')} hint={t('From robinhood.com/account/crypto after registering the public key')}>
              <input className="input font-mono" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" required minLength={8} />
            </Field>
            <Field label={t('Private key (base64)')} hint={t('32-byte seed or 64-byte secret key, base64 encoded')}>
              <input className="input font-mono" type="password" value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} autoComplete="off" required minLength={40} />
            </Field>
            <Field label={t('Label (optional)')}>
              <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder={t('Main account')} />
            </Field>
            <div>
              <button className="btn-primary" type="submit" disabled={connect.isPending || !apiKey || !privateKey}>
                {connect.isPending ? <Spinner /> : <Plug size={16} />} {t('Verify & connect')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
