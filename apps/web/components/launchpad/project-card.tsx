'use client';
import Link from 'next/link';
import type { ProjectDTO } from '@launch/types';
import { fmtUsd } from '@/components/ui/primitives';
import { ChainBadge, ProjectLogo } from './common';
import { SocialLinks } from '@/components/ui/brand-icons';

function Metric({ label, value }: { label: string; value: number | null | undefined }) {
  const unavailable = value === null || value === undefined;
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={unavailable ? 'truncate text-xs text-slate-500' : 'truncate text-sm font-semibold text-slate-100'}>{fmtUsd(value)}</div>
    </div>
  );
}

export function ProjectCard({ project }: { project: ProjectDTO }) {
  const m = project.token?.metrics ?? null;
  return (
    <Link href={`/projects/${project.slug}`} className="card group flex flex-col gap-3 p-4 transition hover:border-ember-500/40 hover:shadow-glow">
      <div className="flex items-center gap-3">
        <ProjectLogo logoUrl={project.logoUrl} name={project.name} symbol={project.symbol} size={48} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display font-semibold text-white group-hover:text-ember-300">{project.name}</div>
          <div className="truncate font-mono text-xs text-slate-400">${project.symbol}</div>
        </div>
        <ChainBadge chain={project.chain} />
        <SocialLinks size={12} links={{ twitter: project.twitter, discord: project.discord, telegram: project.telegram, website: project.website }} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/[0.06] pt-3">
        <Metric label="Price" value={m?.priceUsd} />
        <Metric label="Market cap" value={m?.marketCapUsd} />
        <Metric label="Liquidity" value={m?.liquidityUsd} />
        <Metric label="24h volume" value={m?.volume24hUsd} />
      </div>
    </Link>
  );
}
