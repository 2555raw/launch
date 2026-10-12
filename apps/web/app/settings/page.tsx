'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { TransactionDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useRequireAuth } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { PageHeader, Spinner, shortAddr } from '@/components/ui/primitives';
import { ChainBadge, ExtLink, SectionTitle } from '@/components/launchpad/common';
import { RobinhoodCapabilities, RobinhoodConnection } from '@/components/wallet/robinhood-connect';
import { RobinhoodAccountPanel, RobinhoodOrders, RobinhoodQuotes } from '@/components/wallet/robinhood-trading';
import type { RhConnection } from '@/components/wallet/robinhood-types';

function AccountSection() {
  const t = useT();
  const { user, wallets } = useAuth();
  if (!user) return null;
  return (
    <div className="card grid gap-3 p-4 sm:grid-cols-4">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{t('Username')}</div>
        <div className="font-display font-semibold text-white">{user.username}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{t('Email')}</div>
        <div className="text-sm text-slate-200">{user.email ?? <span className="text-slate-500">{t('None (wallet account)')}</span>}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{t('Role')}</div>
        <div className="text-sm text-slate-200">{t(user.role.toLowerCase())}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{t('Linked wallets')}</div>
        <div className="text-sm text-slate-200">
          {wallets.length} ·{' '}
          <Link href="/wallet" className="text-ember-300 hover:underline">
            {t('manage')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function TransactionsSection() {
  const t = useT();
  const q = useQuery({ queryKey: ['transactions'], queryFn: () => api<{ items: TransactionDTO[] }>('/transactions') });
  return (
    <div className="card p-4">
      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> {t('Loading…')}
        </div>
      ) : q.isError ? (
        <div className="text-sm text-rose-300">{errorMessage(q.error)}</div>
      ) : q.data?.items.length === 0 ? (
        <div className="text-sm text-slate-500">{t('No transactions recorded yet. Token launches and swaps made through Launch appear here.')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-1 pr-3">{t('Chain')}</th>
                <th className="py-1 pr-3">{t('Kind')}</th>
                <th className="py-1 pr-3">{t('Status')}</th>
                <th className="py-1 pr-3">{t('Asset')}</th>
                <th className="py-1 pr-3">{t('Signature')}</th>
                <th className="py-1">{t('When')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {q.data?.items.map((tx) => (
                <tr key={tx.id}>
                  <td className="py-2 pr-3">
                    <ChainBadge chain={tx.chain} network={tx.network} />
                  </td>
                  <td className="py-2 pr-3 text-slate-100">{tx.kind.replace(/_/g, ' ').toLowerCase()}</td>
                  <td className="py-2 pr-3">
                    <span className={`badge ${tx.status === 'CONFIRMED' ? 'border-mint-500/40 text-mint-400' : tx.status === 'FAILED' ? 'border-rose-500/40 text-rose-300' : 'border-gold-500/40 text-gold-300'}`}>{t(tx.status.toLowerCase())}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-slate-400">{tx.asset ? shortAddr(tx.asset, 4) : '—'}</td>
                  <td className="py-2 pr-3 font-mono text-xs">
                    <ExtLink href={tx.explorerUrl}>{shortAddr(tx.signature, 6)}</ExtLink>
                  </td>
                  <td className="py-2 text-xs text-slate-400">{new Date(tx.confirmedAt ?? tx.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const t = useT();
  const user = useRequireAuth();
  const conn = useQuery({ queryKey: ['robinhood', 'connection'], queryFn: () => api<{ connection: RhConnection | null }>('/robinhood/connection'), enabled: !!user });
  if (!user) return null;
  const connected = !!conn.data?.connection;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title={t('Settings')} subtitle={t('Account, Robinhood Crypto Trading API and your transaction history.')} />

      <section>
        <SectionTitle>{t('Account')}</SectionTitle>
        <AccountSection />
      </section>

      <section>
        <SectionTitle>{t('Robinhood Crypto Trading API')}</SectionTitle>
        <p className="mb-3 text-sm text-slate-400">{t('Trade crypto on your own Robinhood account through its official API. Stock, ETF and options trading have no public API and are not implemented here, not simulated.')}</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <RobinhoodCapabilities />
          <RobinhoodConnection />
        </div>
        {connected && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <RobinhoodAccountPanel />
            <RobinhoodQuotes />
            <div className="lg:col-span-2">
              <RobinhoodOrders />
            </div>
          </div>
        )}
      </section>

      <section>
        <SectionTitle>{t('Transactions')}</SectionTitle>
        <TransactionsSection />
      </section>
    </div>
  );
}
