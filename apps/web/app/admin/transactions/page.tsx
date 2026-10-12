'use client';
import { useQuery } from '@tanstack/react-query';
import type { Chain, TransactionStatus } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { JsonView } from '@/components/admin/json-view';
import { StatusBadge } from '@/components/admin/status-badge';
import { fmtDate } from '@/components/ui/dates';
import { Empty, PageHeader, Spinner, shortAddr } from '@/components/ui/primitives';
import { Table, Td, Th, Tr } from '@/components/ui/table';

/** Raw Transaction rows plus the user summary the route includes. */
interface TxRow {
  id: string;
  userId: string | null;
  chain: Chain;
  network: string;
  signature: string;
  kind: string;
  status: TransactionStatus;
  fromAddress: string | null;
  toAddress: string | null;
  amount: string | null;
  asset: string | null;
  blockRef: string | null;
  raw: unknown;
  confirmedAt: string | null;
  createdAt: string;
  user: { username: string } | null;
}

export default function AdminTransactionsPage() {
  const t = useT();
  const q = useQuery({ queryKey: ['admin', 'transactions'], queryFn: () => api<{ items: TxRow[] }>('/admin/transactions'), refetchInterval: 30_000 });
  return (
    <div>
      <PageHeader title={t('Transactions')} subtitle={t('Tracked on-chain transactions (up to 100, newest first). Refreshes every 30s.')} />
      {q.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> {t('Loading transactions…')}</div>
      ) : q.error ? (
        <Empty title={t('Could not load transactions')} body={errorMessage(q.error)} action={<button className="btn-secondary" onClick={() => void q.refetch()}>{t('Retry')}</button>} />
      ) : q.data && q.data.items.length === 0 ? (
        <Empty title={t('No transactions yet')} />
      ) : (
        <div className="card p-2 sm:p-4">
          <Table>
            <thead>
              <tr>
                <Th>{t('When')}</Th>
                <Th>{t('User')}</Th>
                <Th>{t('Kind')}</Th>
                <Th>{t('Chain')}</Th>
                <Th>{t('Status')}</Th>
                <Th className="text-right">{t('Amount')}</Th>
                <Th>{t('From → To')}</Th>
                <Th>{t('Signature')}</Th>
                <Th>{t('Raw')}</Th>
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((tx) => (
                <Tr key={tx.id}>
                  <Td className="text-xs text-slate-400">
                    {fmtDate(tx.createdAt)}
                    {tx.confirmedAt && <div className="text-[10px] text-mint-400">{t('confirmed {date}', { date: fmtDate(tx.confirmedAt) })}</div>}
                  </Td>
                  <Td className="text-xs text-slate-300">{tx.user?.username ?? <span className="text-slate-600">—</span>}</Td>
                  <Td className="font-mono text-xs">{tx.kind}</Td>
                  <Td className="text-xs">
                    {tx.chain === 'SOLANA' ? 'Solana' : 'Robinhood Chain'}
                    <div className="text-slate-500">{tx.network}</div>
                  </Td>
                  <Td><StatusBadge value={tx.status} /></Td>
                  <Td className="text-right font-mono text-xs">{tx.amount ? `${tx.amount}${tx.asset ? ` ${tx.asset}` : ''}` : '—'}</Td>
                  <Td className="font-mono text-[11px] text-slate-400">
                    {tx.fromAddress ? shortAddr(tx.fromAddress) : '—'} → {tx.toAddress ? shortAddr(tx.toAddress) : '—'}
                  </Td>
                  <Td className="font-mono text-[11px]" title={tx.signature}>{shortAddr(tx.signature, 6)}</Td>
                  <Td><JsonView value={tx.raw} label="raw" /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
