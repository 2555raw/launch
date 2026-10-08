'use client';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, X } from 'lucide-react';
import type { Chain, ProjectStatus } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { StatusBadge } from '@/components/admin/status-badge';
import { fmtDate } from '@/components/ui/dates';
import { Empty, PageHeader, Spinner, shortAddr } from '@/components/ui/primitives';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

/** Raw Token rows from the database plus the project summary the route includes. */
interface TokenRow {
  id: string;
  projectId: string;
  chain: Chain;
  network: string;
  address: string;
  creatorWallet: string;
  createTxSignature: string;
  decimals: number;
  supply: string;
  tokenProgram: string | null;
  metadataUri: string | null;
  mintAuthorityRevoked: boolean;
  verifiedAt: string;
  metricsFetchedAt: string | null;
  createdAt: string;
  project: { name: string; symbol: string; slug: string; status: ProjectStatus };
}

function formatSupply(supply: string, decimals: number): string {
  try {
    const n = BigInt(supply);
    const base = BigInt(10) ** BigInt(decimals);
    const whole = n / base;
    return whole.toLocaleString();
  } catch {
    return supply;
  }
}

function CopyAddr({ value, chars = 6 }: { value: string; chars?: number }) {
  return (
    <button
      className="flex items-center gap-1 font-mono text-xs text-slate-200 hover:text-ember-300"
      title={value}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => toast.info('Copied', shortAddr(value, 8)));
      }}
    >
      {shortAddr(value, chars)} <Copy size={11} className="text-slate-500" />
    </button>
  );
}

export default function AdminTokensPage() {
  const q = useQuery({ queryKey: ['admin', 'tokens'], queryFn: () => api<{ items: TokenRow[] }>('/admin/tokens') });
  return (
    <div>
      <PageHeader title="Tokens" subtitle="On-chain tokens verified for launchpad projects (up to 100, newest first)." />
      {q.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Loading tokens…</div>
      ) : q.error ? (
        <Empty title="Could not load tokens" body={errorMessage(q.error)} action={<button className="btn-secondary" onClick={() => void q.refetch()}>Retry</button>} />
      ) : q.data && q.data.items.length === 0 ? (
        <Empty title="No tokens yet" />
      ) : (
        <div className="card p-2 sm:p-4">
          <Table>
            <thead>
              <tr>
                <Th>Project</Th>
                <Th>Chain</Th>
                <Th>Address</Th>
                <Th>Creator wallet</Th>
                <Th className="text-right">Supply</Th>
                <Th>Mint authority</Th>
                <Th>Create tx</Th>
                <Th>Verified</Th>
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((t) => (
                <Tr key={t.id}>
                  <Td>
                    <div className="font-semibold text-slate-100">
                      {t.project.name} <span className="font-mono text-xs text-slate-500">{t.project.symbol}</span>
                    </div>
                    <div className="mt-0.5"><StatusBadge value={t.project.status} /></div>
                  </Td>
                  <Td className="text-xs">
                    {t.chain === 'SOLANA' ? 'Solana' : 'Robinhood Chain'}
                    <div className="text-slate-500">{t.network}</div>
                    {t.tokenProgram && <div className="font-mono text-[10px] text-slate-600">{shortAddr(t.tokenProgram)}</div>}
                  </Td>
                  <Td><CopyAddr value={t.address} /></Td>
                  <Td><CopyAddr value={t.creatorWallet} /></Td>
                  <Td className="text-right font-mono text-xs">
                    {formatSupply(t.supply, t.decimals)}
                    <div className="text-[10px] text-slate-500">{t.decimals} decimals</div>
                  </Td>
                  <Td>
                    {t.mintAuthorityRevoked ? (
                      <span className="badge gap-1 border-mint-500/30 text-mint-400"><Check size={10} /> revoked</span>
                    ) : (
                      <span className="badge gap-1 border-amber-500/30 text-amber-300"><X size={10} /> active</span>
                    )}
                  </Td>
                  <Td><CopyAddr value={t.createTxSignature} chars={5} /></Td>
                  <Td className="text-xs text-slate-400">{fmtDate(t.verifiedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
