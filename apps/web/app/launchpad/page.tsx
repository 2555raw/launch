'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Compass, Rocket, ShieldCheck, Wallet } from 'lucide-react';
import type { ProjectDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Empty, PageHeader, Spinner } from '@/components/ui/primitives';
import { ChainBadge, ProjectLogo, SectionTitle, StatusPill } from '@/components/launchpad/common';

function continueStep(p: ProjectDTO): number {
  if (p.status === 'PUBLISHED') return 6;
  if (p.status === 'AWAITING_SIGNATURE' || p.status === 'VERIFYING') return 5;
  if (p.status === 'FAILED') return 4;
  return p.logoUrl ? 4 : 3;
}

export default function LaunchpadPage() {
  const { user, ready } = useAuth();
  const mine = useQuery({ queryKey: ['launchpad', 'mine'], queryFn: () => api<{ items: ProjectDTO[] }>('/launchpad/mine'), enabled: !!user });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Launchpad" subtitle="Create a real token on Solana or Robinhood Chain, signed and paid for by your own wallet." />

      <section className="card relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-ember-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-elixir-500/15 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <ChainBadge chain="SOLANA" />
              <ChainBadge chain="ROBINHOOD" />
            </div>
            <h2 className="font-display text-2xl font-bold text-white md:text-3xl">Launch a token in minutes. On chain, for real.</h2>
            <p className="mt-3 max-w-xl text-sm text-slate-300">
              Describe your token, upload a logo, review the metadata, then sign one transaction with Phantom, Solflare or an EVM wallet. The mint or contract is created directly from your wallet; we only verify it on chain and list it.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/launchpad/new" className="btn-primary">
                <Rocket size={16} /> Create a token
              </Link>
              <Link href="/projects" className="btn-secondary">
                <Compass size={16} /> Explore projects
              </Link>
            </div>
          </div>
          <ul className="grid gap-2 text-sm text-slate-300">
            <li className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
              <Wallet size={16} className="mt-0.5 shrink-0 text-ember-400" />
              <span>Your wallet pays rent and network fees and becomes the token owner. We never hold keys or funds.</span>
            </li>
            <li className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-mint-400" />
              <span>Solana mints use Token-2022 with on-chain metadata; Robinhood Chain tokens are a verified ERC-20 with optional fixed supply.</span>
            </li>
            <li className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
              <Compass size={16} className="mt-0.5 shrink-0 text-elixir-400" />
              <span>Published tokens appear in discovery with live market data when a DEX pair is indexed.</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle
          actions={
            user && (
              <Link href="/launchpad/new" className="btn-secondary text-xs">
                New project
              </Link>
            )
          }
        >
          Your projects
        </SectionTitle>
        {!ready ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Spinner /> Loading…
          </div>
        ) : !user ? (
          <Empty
            title="Sign in to see your projects"
            body="Drafts, pending launches and published tokens are tied to your account."
            action={
              <Link href="/login" className="btn-primary">
                Sign in
              </Link>
            }
          />
        ) : mine.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Spinner /> Loading your projects…
          </div>
        ) : mine.isError ? (
          <Empty title="Could not load projects" body={errorMessage(mine.error)} action={<button className="btn-secondary" onClick={() => void mine.refetch()}>Retry</button>} />
        ) : mine.data && mine.data.items.length === 0 ? (
          <Empty
            title="No projects yet"
            body="Start the wizard to create your first token."
            action={
              <Link href="/launchpad/new" className="btn-primary">
                <Rocket size={16} /> Create a token
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-2">
            {mine.data?.items.map((p) => (
              <li key={p.id} className="card flex flex-wrap items-center gap-3 p-3 sm:p-4">
                <ProjectLogo logoUrl={p.logoUrl} name={p.name} symbol={p.symbol} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-display font-semibold text-white">{p.name}</span>
                    <span className="font-mono text-xs text-slate-400">${p.symbol}</span>
                    <StatusPill status={p.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <ChainBadge chain={p.chain} network={p.network} />
                    <span>Created {new Date(p.createdAt).toLocaleDateString()}</span>
                    {p.publishedAt && <span>· Published {new Date(p.publishedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                {p.status === 'PUBLISHED' ? (
                  <Link href={`/projects/${p.slug}`} className="btn-secondary text-xs">
                    View <ArrowRight size={14} />
                  </Link>
                ) : (
                  <Link href={`/launchpad/new?project=${p.id}&step=${continueStep(p)}`} className="btn-primary text-xs">
                    Continue <ArrowRight size={14} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
