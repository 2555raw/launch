'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { Chain } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useRequireAuth } from '@/lib/hooks';
import { Empty, PageHeader, Spinner, shortAddr } from '@/components/ui/primitives';
import { AddressLine, ChainBadge, ProjectLogo, SectionTitle, formatUnits } from '@/components/launchpad/common';

interface KnownProject {
  name: string;
  symbol: string;
  slug: string;
  logoUrl: string | null;
}
interface SolToken {
  mint: string;
  amount: number;
  raw: string;
  decimals: number;
  tokenProgram: string;
  project: KnownProject | null;
}
interface EvmToken {
  address: string;
  amount: number;
  raw: string;
  decimals: number;
  project: KnownProject | null;
}
interface WalletSection<T> {
  walletId: string;
  address: string;
  network: string;
  explorerUrl: string;
  native: { symbol: string; amount: number; raw: string } | null;
  tokens: T[];
  error: string | null;
}
interface RhHolding {
  asset_code: string;
  total_quantity: string;
  quantity_available_for_trading: string;
  [key: string]: unknown;
}
interface RhAccount {
  account_number: string;
  status: string;
  buying_power: string;
  buying_power_currency: string;
  [key: string]: unknown;
}
interface Portfolio {
  solana: WalletSection<SolToken>[];
  robinhoodChain: WalletSection<EvmToken>[];
  robinhood: { linked: boolean; holdings: RhHolding[]; account: RhAccount | null; error: string | null };
  generatedAt: string;
}

function TokenRow({ id, amount, raw, decimals, project }: { id: string; amount: number; raw: string; decimals: number; project: KnownProject | null }) {
  const value = raw ? formatUnits(raw, decimals, 6) : amount.toLocaleString(undefined, { maximumFractionDigits: 6 });
  return (
    <li className="flex items-center gap-3 py-2">
      {project ? <ProjectLogo logoUrl={project.logoUrl} name={project.name} symbol={project.symbol} size={28} /> : <div className="h-7 w-7 shrink-0 rounded-lg bg-white/[0.06]" />}
      <div className="min-w-0 flex-1">
        {project ? (
          <Link href={`/projects/${project.slug}`} className="truncate text-sm font-medium text-slate-100 hover:text-ember-300">
            {project.name} <span className="font-mono text-xs text-slate-400">${project.symbol}</span>
          </Link>
        ) : (
          <div className="truncate font-mono text-xs text-slate-300" title={id}>
            {shortAddr(id, 6)}
          </div>
        )}
      </div>
      <div className="font-mono text-sm text-white">{value}</div>
    </li>
  );
}

function WalletCard({ chain, w, kind }: { chain: Chain; w: WalletSection<SolToken> | WalletSection<EvmToken>; kind: 'sol' | 'evm' }) {
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChainBadge chain={chain} network={w.network} />
        <AddressLine address={w.address} explorerUrl={w.explorerUrl} chars={6} />
      </div>
      {w.error ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>RPC read failed: {w.error}</span>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-white">{w.native ? w.native.amount.toLocaleString(undefined, { maximumFractionDigits: 6 }) : 'Data unavailable'}</span>
            {w.native && <span className="text-sm text-slate-400">{w.native.symbol}</span>}
          </div>
          <div className="mt-3 text-[11px] uppercase tracking-wide text-slate-500">Tokens</div>
          {w.tokens.length === 0 ? (
            <div className="py-2 text-sm text-slate-500">{kind === 'evm' ? 'No tokens launched here are held by this wallet.' : 'No token accounts with a balance.'}</div>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {w.tokens.map((t) => ('mint' in t ? <TokenRow key={t.mint} id={t.mint} amount={t.amount} raw={t.raw} decimals={t.decimals} project={t.project} /> : <TokenRow key={t.address} id={t.address} amount={t.amount} raw={t.raw} decimals={t.decimals} project={t.project} />))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const user = useRequireAuth();
  const q = useQuery({ queryKey: ['portfolio'], queryFn: () => api<Portfolio>('/portfolio'), enabled: !!user, staleTime: 15_000 });
  if (!user) return null;
  const d = q.data;
  const walletCount = (d?.solana.length ?? 0) + (d?.robinhoodChain.length ?? 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Portfolio"
        subtitle="Balances are read live from the chain for every linked wallet; nothing is cached or estimated. Robinhood crypto holdings appear when your API credentials are linked."
        actions={
          <button className="btn-secondary" onClick={() => void q.refetch()} disabled={q.isFetching}>
            {q.isFetching ? <Spinner /> : <RefreshCw size={15} />} Refresh
          </button>
        }
      />
      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Reading balances from the chain…
        </div>
      ) : q.isError ? (
        <Empty title="Could not load portfolio" body={errorMessage(q.error)} action={<button className="btn-secondary" onClick={() => void q.refetch()}>Retry</button>} />
      ) : d ? (
        <div className="space-y-8">
          <section>
            <SectionTitle>Wallets</SectionTitle>
            {walletCount === 0 ? (
              <Empty
                title="No linked wallets"
                body="Link a Solana or Robinhood Chain wallet to see its balances here."
                action={
                  <Link href="/wallet" className="btn-primary">
                    Go to Wallet
                  </Link>
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {d.solana.map((w) => (
                  <WalletCard key={w.walletId} chain="SOLANA" w={w} kind="sol" />
                ))}
                {d.robinhoodChain.map((w) => (
                  <WalletCard key={w.walletId} chain="ROBINHOOD" w={w} kind="evm" />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionTitle>Robinhood Crypto</SectionTitle>
            {!d.robinhood.linked ? (
              <div className="card p-4 text-sm text-slate-400">
                Not linked —{' '}
                <Link href="/settings" className="text-ember-300 hover:underline">
                  add your Robinhood Crypto API credentials in Settings
                </Link>
                .
              </div>
            ) : (
              <div className="card p-4">
                {d.robinhood.error && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>{d.robinhood.error}</span>
                  </div>
                )}
                {d.robinhood.account ? (
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">Buying power</div>
                      <div className="font-display text-2xl font-bold text-white">
                        {Number(d.robinhood.account.buying_power).toLocaleString(undefined, { style: 'currency', currency: d.robinhood.account.buying_power_currency || 'USD' })}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      Account {d.robinhood.account.account_number} · {d.robinhood.account.status}
                    </div>
                  </div>
                ) : (
                  !d.robinhood.error && <div className="text-sm text-slate-500">Account data unavailable.</div>
                )}
                <div className="mt-4 text-[11px] uppercase tracking-wide text-slate-500">Holdings</div>
                {d.robinhood.holdings.length === 0 ? (
                  <div className="py-2 text-sm text-slate-500">No crypto holdings.</div>
                ) : (
                  <table className="mt-1 w-full text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="py-1">Asset</th>
                        <th className="py-1 text-right">Total</th>
                        <th className="py-1 text-right">Available</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {d.robinhood.holdings.map((h) => (
                        <tr key={h.asset_code}>
                          <td className="py-2 font-semibold text-white">{h.asset_code}</td>
                          <td className="py-2 text-right font-mono">{h.total_quantity}</td>
                          <td className="py-2 text-right font-mono text-slate-400">{h.quantity_available_for_trading}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </section>
          <div className="text-xs text-slate-600">Generated {new Date(d.generatedAt).toLocaleString()}</div>
        </div>
      ) : null}
    </div>
  );
}
