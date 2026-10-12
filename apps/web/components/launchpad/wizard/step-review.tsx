'use client';
import { SocialLinks } from '@/components/ui/brand-icons';
import { useMutation } from '@tanstack/react-query';
import { FileJson, Pencil } from 'lucide-react';
import type { ProjectDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { toast } from '@/components/ui/toast';
import { Spinner, shortAddr } from '@/components/ui/primitives';
import { ChainBadge, ExtLink, ProjectLogo, formatWhole } from '../common';
import type { PreparedLaunch } from './state';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-white/[0.05] py-2 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="w-40 shrink-0 text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="min-w-0 flex-1 break-words text-sm text-slate-100">{children}</div>
    </div>
  );
}

export function StepReview({ project, fixedSupply, revokeFreeze, prepared, onPrepared, onEdit, onBack, onNext }: { project: ProjectDTO; fixedSupply: boolean; revokeFreeze: boolean; prepared: PreparedLaunch | null; onPrepared: (p: PreparedLaunch) => void; onEdit: (step: number) => void; onBack: () => void; onNext: () => void }) {
  const t = useT();
  const prepare = useMutation({
    mutationFn: () => api<PreparedLaunch>(`/launchpad/projects/${project.id}/prepare`, { method: 'POST' }),
    onSuccess: (p) => {
      onPrepared(p);
      toast.success(t('Metadata published'), t('The off-chain metadata JSON is ready. Next: sign the transaction.'));
    },
    onError: (e) => toast.error(t('Could not prepare launch'), errorMessage(e)),
  });
  const current = prepared && prepared.project.id === project.id ? prepared : null;
  const sol = project.chain === 'SOLANA';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">{t('Review')}</h2>
        <p className="mt-1 text-sm text-slate-400">{t('Check everything. Preparing writes the metadata JSON that the token will point to; the on-chain part happens in the next step.')}</p>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-4">
          <ProjectLogo logoUrl={project.logoUrl} name={project.name} symbol={project.symbol} size={64} />
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-semibold text-white">{project.name}</div>
            <div className="font-mono text-sm text-slate-400">${project.symbol}</div>
          </div>
          <div className="ml-auto">
            <ChainBadge chain={project.chain} network={project.network} />
          </div>
        </div>
        <div className="mt-4">
          <Row label={t('Description')}>{project.description || <span className="text-slate-500">{t('None')}</span>}</Row>
          <Row label={t('Total supply')}>
            {formatWhole(project.totalSupply)} {project.symbol} <span className="text-slate-500">· {t('{n} decimals', { n: project.decimals })}</span>
          </Row>
          <Row label={t('Fixed supply')}>{fixedSupply ? <span className="text-mint-400">{t('Yes — {how}', { how: sol ? t('mint authority revoked') : t('minting disabled') })}</span> : <span className="text-gold-300">{t('No — you keep the ability to mint')}</span>}</Row>
          {sol && <Row label={t('Freeze authority')}>{revokeFreeze ? <span className="text-mint-400">{t('Revoked')}</span> : <span className="text-gold-300">{t('Kept by creator wallet')}</span>}</Row>}
          <Row label={t('Links')}>
            {[project.website, project.twitter, project.discord, project.telegram].filter(Boolean).length === 0 ? (
              <span className="text-slate-500">{t('None')}</span>
            ) : (
              <div className="flex flex-wrap gap-3 text-xs">
                <SocialLinks links={{ website: project.website, twitter: project.twitter, discord: project.discord, telegram: project.telegram }} labels />
              </div>
            )}
          </Row>
          <Row label={t('Logo')}>{project.logoUrl ? <ExtLink href={project.logoUrl}>{t('Uploaded')}</ExtLink> : <span className="text-gold-300">{t('Not uploaded (you can add it later only before launch)')}</span>}</Row>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-ghost text-xs" onClick={() => onEdit(2)}>
            <Pencil size={14} /> {t('Edit details')}
          </button>
          <button className="btn-ghost text-xs" onClick={() => onEdit(3)}>
            <Pencil size={14} /> {t('Change logo')}
          </button>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 font-display font-semibold text-white">
          <FileJson size={16} className="text-ember-400" /> {t('Token metadata')}
        </div>
        {current ? (
          <div className="mt-3 space-y-2 text-sm">
            <div className="text-mint-400">{t('Metadata JSON written.')}</div>
            <div className="break-all font-mono text-xs text-slate-300">
              <ExtLink href={current.metadataUri}>{current.metadataUri}</ExtLink>
            </div>
            <div className="text-xs text-slate-500">{t('Linked {chain} wallets: {list}', { chain: sol ? 'Solana' : 'Robinhood Chain', list: current.linkedWallets.map((w) => shortAddr(w, 4)).join(', ') })}</div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-400">{t("Generates the JSON file (name, symbol, description, image, links) that the token's URI points to and marks the project as awaiting signature.")}</p>
            <button className="btn-primary" disabled={prepare.isPending} onClick={() => prepare.mutate()}>
              {prepare.isPending && <Spinner />} {t('Prepare launch')}
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button type="button" className="btn-ghost" onClick={onBack}>
          {t('Back')}
        </button>
        <button type="button" className="btn-primary" disabled={!current} onClick={onNext}>
          {t('Continue to signing')}
        </button>
      </div>
    </div>
  );
}
