'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeOff, ExternalLink, X } from 'lucide-react';
import type { ProjectDTO, ProjectStatus } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useT } from '@/lib/i18n';
import { can } from '@/components/admin/permissions';
import { StatusBadge } from '@/components/admin/status-badge';
import { fmtDate } from '@/components/ui/dates';
import { Empty, PageHeader, Spinner, shortAddr } from '@/components/ui/primitives';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

const STATUSES: Array<ProjectStatus | ''> = ['', 'PUBLISHED', 'VERIFYING', 'AWAITING_SIGNATURE', 'DRAFT', 'FAILED'];

function UnpublishForm({ project, onClose }: { project: ProjectDTO; onClose: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const m = useMutation({
    mutationFn: () => api<{ ok: true }>(`/admin/projects/${project.id}/unpublish`, { method: 'POST', json: { reason: reason.trim() } }),
    onSuccess: () => {
      toast.success(t('{name} unpublished', { name: project.name }));
      void qc.invalidateQueries({ queryKey: ['admin', 'projects'] });
      onClose();
    },
    onError: (e) => toast.error(t('Unpublish failed'), errorMessage(e)),
  });
  return (
    <form
      className="card animate-rise mb-4 flex flex-wrap items-end gap-3 border-rose-500/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim().length < 3) return toast.error(t('Reason required'), t('Give at least 3 characters.'));
        if (window.confirm(t('Unpublish {name} ({symbol})? The project is marked FAILED with your reason.', { name: project.name, symbol: project.symbol }))) m.mutate();
      }}
    >
      <div className="min-w-[260px] flex-1">
        <label className="label">
          {t('Unpublish {name} ({symbol}) — reason', { name: project.name, symbol: project.symbol })}
        </label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus placeholder={t("Shown in the project's failure reason")} />
      </div>
      <button type="submit" className="btn-danger" disabled={m.isPending}>
        {m.isPending ? <Spinner /> : <EyeOff size={16} />} {t('Unpublish')}
      </button>
      <button type="button" className="btn-ghost" onClick={onClose}><X size={14} /> {t('Cancel')}</button>
    </form>
  );
}

export default function AdminProjectsPage() {
  const t = useT();
  const me = useAuth((s) => s.user);
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [target, setTarget] = useState<ProjectDTO | null>(null);
  const q = useQuery({ queryKey: ['admin', 'projects', status], queryFn: () => api<{ items: ProjectDTO[] }>(`/admin/projects${status ? `?status=${status}` : ''}`) });

  return (
    <div>
      <PageHeader
        title={t('Projects')}
        subtitle={t('Launchpad token projects (up to 100, newest first).')}
        actions={
          <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus | '')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? t(s.toLowerCase().replace(/_/g, ' ')) : t('All statuses')}
              </option>
            ))}
          </select>
        }
      />
      {target && <UnpublishForm project={target} onClose={() => setTarget(null)} />}
      {q.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> {t('Loading projects…')}</div>
      ) : q.error ? (
        <Empty title={t('Could not load projects')} body={errorMessage(q.error)} action={<button className="btn-secondary" onClick={() => void q.refetch()}>{t('Retry')}</button>} />
      ) : q.data && q.data.items.length === 0 ? (
        <Empty title={t('No projects')} body={status ? t('No projects with status {status}.', { status: t(status.toLowerCase().replace(/_/g, ' ')) }) : undefined} />
      ) : (
        <div className="card p-2 sm:p-4">
          <Table>
            <thead>
              <tr>
                <Th>{t('Project')}</Th>
                <Th>{t('Chain')}</Th>
                <Th>{t('Status')}</Th>
                <Th>{t('Creator')}</Th>
                <Th>{t('Token')}</Th>
                <Th>{t('Created')}</Th>
                <Th>{t('Published')}</Th>
                {can(me?.role, 'unpublish') && <Th className="text-right">{t('Actions')}</Th>}
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      {p.logoUrl ? <img src={p.logoUrl} alt="" className="h-7 w-7 rounded-lg object-cover" /> : <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-[10px] font-bold text-slate-300">{p.symbol.slice(0, 3)}</span>}
                      <div>
                        <div className="font-semibold text-slate-100">
                          {p.name} <span className="font-mono text-xs text-slate-500">{p.symbol}</span>
                        </div>
                        <div className="font-mono text-[10px] text-slate-600">{p.slug}</div>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-xs">
                    {p.chain === 'SOLANA' ? 'Solana' : 'Robinhood Chain'}
                    <div className="text-slate-500">{p.network}</div>
                  </Td>
                  <Td><StatusBadge value={p.status} /></Td>
                  <Td className="text-xs text-slate-300">{p.creator.username}</Td>
                  <Td className="font-mono text-xs">
                    {p.token ? (
                      <a href={p.token.explorerUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-slate-200 hover:text-ember-300">
                        {shortAddr(p.token.address, 6)} <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </Td>
                  <Td className="text-xs text-slate-400">{fmtDate(p.createdAt)}</Td>
                  <Td className="text-xs text-slate-400">{fmtDate(p.publishedAt)}</Td>
                  {can(me?.role, 'unpublish') && (
                    <Td className="text-right">
                      {p.status === 'PUBLISHED' && (
                        <button className="btn-ghost px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10" onClick={() => setTarget(p)}>
                          <EyeOff size={12} /> {t('Unpublish')}
                        </button>
                      )}
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
