'use client';
import Link from 'next/link';
import { PartyPopper, Rocket } from 'lucide-react';
import type { ProjectDTO } from '@launch/types';
import { AddressLine, ChainBadge, ExtLink, ProjectLogo, formatUnits } from '../common';

export function StepDone({ project }: { project: ProjectDTO }) {
  const t = project.token;
  return (
    <div className="space-y-6">
      <div className="card relative overflow-hidden p-6 text-center">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-ember-500/10 via-transparent to-mint-500/10" />
        <div className="relative">
          <PartyPopper size={36} className="mx-auto text-ember-400" />
          <h2 className="mt-3 font-display text-2xl font-bold text-white">{project.name} is live</h2>
          <p className="mt-1 text-sm text-slate-400">Verified on chain and published to the launchpad.</p>
          <div className="mt-4 flex justify-center">
            <ProjectLogo logoUrl={project.logoUrl} name={project.name} symbol={project.symbol} size={72} />
          </div>
          <div className="mt-3 flex justify-center">
            <ChainBadge chain={project.chain} network={project.network} />
          </div>
        </div>
      </div>

      {t ? (
        <div className="card divide-y divide-white/[0.05] p-4 text-sm">
          <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center">
            <div className="w-44 text-xs uppercase tracking-wide text-slate-500">Token address</div>
            <AddressLine address={t.address} explorerUrl={t.explorerUrl} chars={8} />
          </div>
          <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center">
            <div className="w-44 text-xs uppercase tracking-wide text-slate-500">{project.chain === 'SOLANA' ? 'Transaction signature' : 'Transaction hash'}</div>
            <AddressLine address={t.createTxSignature} explorerUrl={t.txExplorerUrl} chars={8} />
          </div>
          <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center">
            <div className="w-44 text-xs uppercase tracking-wide text-slate-500">Supply</div>
            <div className="text-slate-100">
              {formatUnits(t.supply, t.decimals)} {project.symbol} · {t.decimals} decimals · {t.mintAuthorityRevoked ? 'fixed supply' : 'mintable'}
            </div>
          </div>
          {t.metadataUri && (
            <div className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center">
              <div className="w-44 text-xs uppercase tracking-wide text-slate-500">Metadata</div>
              <ExtLink href={t.metadataUri} className="break-all text-xs">
                {t.metadataUri}
              </ExtLink>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-4 text-sm text-slate-400">Token details are still loading.</div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Link href={`/projects/${project.slug}`} className="btn-primary">
          View project page
        </Link>
        <Link href="/launchpad/new" className="btn-secondary">
          <Rocket size={16} /> Launch another
        </Link>
      </div>
    </div>
  );
}
