'use client';
import { useQuery } from '@tanstack/react-query';
import type { Chain, TransactionStatus } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
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
  const q = useQuery({ queryKey: ['admin', 'transactions'], queryFn: () => api<{ items: TxRow[] }>('/admin/transactions'), refetchInterval: 30_000 });
  return (
    <div>
      <PageHeader title="Transactions" subtitle="Tracked on-chain transactions (up to 100, newest first). Refreshes every 30s." />
      {q.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Loading transactions…</div>
      ) : q.error ? (
        <Empty title="Could not load transactions" body={errorMessage(q.error)} action={<button className="btn-secondary" onClick={() => void q.refetch()}>Retry</button>} />
      ) : q.data && q.data.items.length === 0 ? (
        <Empty title="No transactions yet" />
      ) : (
        <div className="card p-2 sm:p-4">
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>User</Th>
                <Th>Kind</Th>
                <Th>Chain</Th>
                <Th>Status</Th>
                <Th className="text-right">Amount</Th>
                <Th>From → To</Th>
                <Th>Signature</Th>
                <Th>Raw</Th>
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((t) => (
                <Tr key={t.id}>
                  <Td className="text-xs text-slate-400">
                    {fmtDate(t.createdAt)}
                    {t.confirmedAt && <div className="text-[10px] text-mint-400">confirmed {fmtDate(t.confirmedAt)}</div>}
                  </Td>
                  <Td className="text-xs text-slate-300">{t.user?.username ?? <span className="text-slate-600">—</span>}</Td>
                  <Td className="font-mono text-xs">{t.kind}</Td>
                  <Td className="text-xs">
                    {t.chain === 'SOLANA' ? 'Solana' : 'Robinhood Chain'}
                    <div className="text-slate-500">{t.network}</div>
                  </Td>
                  <Td><StatusBadge value={t.status} /></Td>
                  <Td className="text-right font-mono text-xs">{t.amount ? `${t.amount}${t.asset ? ` ${t.asset}` : ''}` : '—'}</Td>
                  <Td className="font-mono text-[11px] text-slate-400">
                    {t.fromAddress ? shortAddr(t.fromAddress) : '—'} → {t.toAddress ? shortAddr(t.toAddress) : '—'}
                  </Td>
                  <Td className="font-mono text-[11px]" title={t.signature}>{shortAddr(t.signature, 6)}</Td>
                  <Td><JsonView value={t.raw} label="raw" /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
