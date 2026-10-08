'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { TransactionDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useRequireAuth } from '@/lib/hooks';
import { PageHeader, Spinner, shortAddr } from '@/components/ui/primitives';
import { ChainBadge, ExtLink, SectionTitle } from '@/components/launchpad/common';
import { RobinhoodCapabilities, RobinhoodConnection } from '@/components/wallet/robinhood-connect';
import { RobinhoodAccountPanel, RobinhoodOrders, RobinhoodQuotes } from '@/components/wallet/robinhood-trading';
import type { RhConnection } from '@/components/wallet/robinhood-types';

function AccountSection() {
  const { user, wallets } = useAuth();
  if (!user) return null;
  return (
    <div className="card grid gap-3 p-4 sm:grid-cols-4">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Username</div>
        <div className="font-display font-semibold text-white">{user.username}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Email</div>
        <div className="text-sm text-slate-200">{user.email ?? <span className="text-slate-500">None (wallet account)</span>}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Role</div>
        <div className="text-sm text-slate-200">{user.role.toLowerCase()}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Linked wallets</div>
        <div className="text-sm text-slate-200">
          {wallets.length} ·{' '}
          <Link href="/wallet" className="text-ember-300 hover:underline">
            manage
          </Link>
        </div>
      </div>
    </div>
  );
}

function TransactionsSection() {
  const q = useQuery({ queryKey: ['transactions'], queryFn: () => api<{ items: TransactionDTO[] }>('/transactions') });
  return (
    <div className="card p-4">
      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Loading…
        </div>
      ) : q.isError ? (
        <div className="text-sm text-rose-300">{errorMessage(q.error)}</div>
      ) : q.data?.items.length === 0 ? (
        <div className="text-sm text-slate-500">No transactions recorded yet. Token launches and swaps made through Launch appear here.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-1 pr-3">Chain</th>
                <th className="py-1 pr-3">Kind</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1 pr-3">Asset</th>
                <th className="py-1 pr-3">Signature</th>
                <th className="py-1">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {q.data?.items.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 pr-3">
                    <ChainBadge chain={t.chain} network={t.network} />
                  </td>
                  <td className="py-2 pr-3 text-slate-100">{t.kind.replace(/_/g, ' ').toLowerCase()}</td>
                  <td className="py-2 pr-3">
                    <span className={`badge ${t.status === 'CONFIRMED' ? 'border-mint-500/40 text-mint-400' : t.status === 'FAILED' ? 'border-rose-500/40 text-rose-300' : 'border-gold-500/40 text-gold-300'}`}>{t.status.toLowerCase()}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-slate-400">{t.asset ? shortAddr(t.asset, 4) : '—'}</td>
                  <td className="py-2 pr-3 font-mono text-xs">
                    <ExtLink href={t.explorerUrl}>{shortAddr(t.signature, 6)}</ExtLink>
                  </td>
                  <td className="py-2 text-xs text-slate-400">{new Date(t.confirmedAt ?? t.createdAt).toLocaleString()}</td>
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
  const user = useRequireAuth();
  const conn = useQuery({ queryKey: ['robinhood', 'connection'], queryFn: () => api<{ connection: RhConnection | null }>('/robinhood/connection'), enabled: !!user });
  if (!user) return null;
  const connected = !!conn.data?.connection;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title="Settings" subtitle="Account, Robinhood Crypto Trading API and your transaction history." />

      <section>
        <SectionTitle>Account</SectionTitle>
        <AccountSection />
      </section>

      <section>
        <SectionTitle>Robinhood Crypto Trading API</SectionTitle>
        <p className="mb-3 text-sm text-slate-400">Trade crypto on your own Robinhood account through its official API. Stock, ETF and options trading have no public API and are not implemented here, not simulated.</p>
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
        <SectionTitle>Transactions</SectionTitle>
        <TransactionsSection />
      </section>
    </div>
  );
}
