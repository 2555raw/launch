'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Globe, MessageCircle, RefreshCw, Send, Twitter } from 'lucide-react';
import type { ProjectDTO, TokenMetricsDTO, TransactionStatus } from '@launch/types';
import { robinhoodExplorerTxUrl, solanaExplorerTxUrl } from '@launch/config/chains';
import { api, errorMessage } from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { Empty, Spinner, shortAddr } from '@/components/ui/primitives';
import { AddressLine, ChainBadge, ExtLink, ProjectLogo, SectionTitle, StatusPill, formatUnits } from '@/components/launchpad/common';
import { MetricsGrid, MetricsSourceNote } from '@/components/launchpad/metrics-grid';

interface ProjectTx {
  id: string;
  kind: string;
  signature: string;
  status: TransactionStatus;
  fromAddress: string | null;
  toAddress: string | null;
  amount: string | null;
  confirmedAt: string | null;
  createdAt: string;
}
interface ProjectResponse {
  project: ProjectDTO;
  transactions: ProjectTx[];
}

function txUrl(p: ProjectDTO, sig: string): string {
  return p.chain === 'SOLANA' ? solanaExplorerTxUrl(sig, p.network as 'devnet' | 'testnet' | 'mainnet-beta') : robinhoodExplorerTxUrl(sig, p.network as 'mainnet' | 'testnet');
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="w-40 shrink-0 text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="min-w-0 flex-1 break-words text-sm text-slate-100">{children}</div>
    </div>
  );
}

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['project-page', slug], queryFn: () => api<ProjectResponse>(`/launchpad/projects/${slug}`), enabled: !!slug });
  const refresh = useMutation({
    mutationFn: () => api<{ metrics: TokenMetricsDTO }>(`/launchpad/projects/${slug}/refresh-metrics`, { method: 'POST' }),
    onSuccess: (res) => {
      qc.setQueryData(['project-page', slug], (old: ProjectResponse | undefined) => (old && old.project.token ? { ...old, project: { ...old.project, token: { ...old.project.token, metrics: res.metrics } } } : old));
      toast.success('Metrics refreshed', res.metrics.source === 'dexscreener' ? 'Live DexScreener data loaded.' : 'No DEX pair indexed yet.');
    },
    onError: (e) => toast.error('Could not refresh metrics', errorMessage(e)),
  });

  if (query.isLoading)
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Spinner /> Loading project…
      </div>
    );
  if (query.isError || !query.data)
    return (
      <Empty
        title="Project not found"
        body={query.error ? errorMessage(query.error) : undefined}
        action={
          <Link href="/projects" className="btn-secondary">
            Back to projects
          </Link>
        }
      />
    );

  const { project: p, transactions } = query.data;
  const t = p.token;
  const socials = [
    { href: p.website, label: 'Website', icon: Globe },
    { href: p.twitter, label: 'X', icon: Twitter },
    { href: p.discord, label: 'Discord', icon: MessageCircle },
    { href: p.telegram, label: 'Telegram', icon: Send },
  ].filter((s): s is { href: string; label: string; icon: typeof Globe } => !!s.href);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/projects" className="mb-4 inline-block text-xs text-slate-400 hover:text-slate-200">
        ← All projects
      </Link>

      <header className="card flex flex-col gap-4 p-5 md:flex-row md:items-start">
        <ProjectLogo logoUrl={p.logoUrl} name={p.name} symbol={p.symbol} size={88} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-white md:text-3xl">{p.name}</h1>
            <span className="font-mono text-base text-slate-400">${p.symbol}</span>
            {p.status !== 'PUBLISHED' && <StatusPill status={p.status} />}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ChainBadge chain={p.chain} network={p.network} />
            {t && <span className="badge font-mono">{t.tokenProgram ?? (p.chain === 'SOLANA' ? 'SPL' : 'ERC20')}</span>}
            <span className="text-xs text-slate-500">by {p.creator.username}</span>
          </div>
          {socials.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="btn-secondary px-3 py-1 text-xs">
                  <s.icon size={13} /> {s.label}
                </a>
              ))}
            </div>
          )}
          {p.description && <p className="mt-3 whitespace-pre-line text-sm text-slate-300">{p.description}</p>}
        </div>
        {t && p.chain === 'SOLANA' && (
          <Link href={`/wallet?swap=${t.address}`} className="btn-primary shrink-0">
            <ArrowLeftRight size={16} /> Trade on Launch
          </Link>
        )}
      </header>

      <section className="mt-6">
        <SectionTitle
          actions={
            t && (
              <button className="btn-secondary text-xs" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
                {refresh.isPending ? <Spinner /> : <RefreshCw size={14} />} Refresh metrics
              </button>
            )
          }
        >
          Market
        </SectionTitle>
        <MetricsGrid metrics={t?.metrics ?? null} />
        <div className="mt-2">
          <MetricsSourceNote metrics={t?.metrics ?? null} />
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle>Token</SectionTitle>
        {t ? (
          <div className="card divide-y divide-white/[0.05] px-4 py-2">
            <Row label="Address">
              <AddressLine address={t.address} explorerUrl={t.explorerUrl} chars={8} />
            </Row>
            <Row label="Creator">
              {p.creator.username} · <AddressLine address={t.creatorWallet} />
            </Row>
            <Row label="Total supply">
              {formatUnits(t.supply, t.decimals)} {p.symbol}
            </Row>
            <Row label="Decimals">{t.decimals}</Row>
            <Row label="Token program">{t.tokenProgram ?? 'Data unavailable'}</Row>
            <Row label="Metadata URI">{t.metadataUri ? <ExtLink href={t.metadataUri} className="break-all text-xs">{t.metadataUri}</ExtLink> : 'Data unavailable'}</Row>
            <Row label="Mint authority revoked">{t.mintAuthorityRevoked ? <span className="text-mint-400">Yes — fixed supply</span> : <span className="text-gold-300">No — creator can mint more</span>}</Row>
            <Row label="Creation transaction">
              <AddressLine address={t.createTxSignature} explorerUrl={t.txExplorerUrl} chars={8} />
            </Row>
            <Row label="Created">{new Date(t.verifiedAt).toLocaleString()}</Row>
          </div>
        ) : (
          <div className="card p-4 text-sm text-slate-400">This project has not been published on chain yet.</div>
        )}
      </section>

      <section className="mt-6">
        <SectionTitle>Transactions</SectionTitle>
        {transactions.length === 0 ? (
          <div className="card p-4 text-sm text-slate-500">No transactions recorded for this token yet.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Kind</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">From</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Signature</th>
                  <th className="px-4 py-2">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-2 font-medium text-slate-100">{tx.kind.replace(/_/g, ' ').toLowerCase()}</td>
                    <td className="px-4 py-2">
                      <span className={`badge ${tx.status === 'CONFIRMED' ? 'border-mint-500/40 text-mint-400' : tx.status === 'FAILED' ? 'border-rose-500/40 text-rose-300' : 'border-gold-500/40 text-gold-300'}`}>{tx.status.toLowerCase()}</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{tx.fromAddress ? shortAddr(tx.fromAddress, 4) : '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{tx.amount && t ? `${formatUnits(tx.amount, t.decimals)} ${p.symbol}` : '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      <ExtLink href={txUrl(p, tx.signature)}>{shortAddr(tx.signature, 6)}</ExtLink>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-400">{new Date(tx.confirmedAt ?? tx.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
