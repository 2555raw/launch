'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Flag, X } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useT } from '@/lib/i18n';
import { can } from '@/components/admin/permissions';
import { StatusBadge } from '@/components/admin/status-badge';
import { fmtDate } from '@/components/ui/dates';
import { Empty, PageHeader, Spinner } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';

type ReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';
interface Report {
  id: string;
  reporterId: string;
  targetType: 'player' | 'clan' | 'project' | 'message' | string;
  targetId: string;
  reason: string;
  status: ReportStatus;
  resolvedById: string | null;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { username: string };
}

function targetHref(r: Report): string | null {
  if (r.targetType === 'player') return `/players/${r.targetId}`;
  if (r.targetType === 'clan') return '/admin/clans';
  if (r.targetType === 'project') return '/admin/projects';
  return null;
}

function ResolveForm({ report, onClose }: { report: Report; onClose: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const [resolution, setResolution] = useState('');
  const m = useMutation({
    mutationFn: (status: 'RESOLVED' | 'DISMISSED') => api<{ ok: true }>(`/admin/reports/${report.id}/resolve`, { method: 'POST', json: { status, resolution: resolution.trim() || undefined } }),
    onSuccess: (_d, status) => {
      toast.success(status === 'RESOLVED' ? t('Report resolved') : t('Report dismissed'));
      void qc.invalidateQueries({ queryKey: ['admin', 'reports'] });
      onClose();
    },
    onError: (e) => toast.error(t('Could not update report'), errorMessage(e)),
  });
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-white/[0.08] bg-ink-950/50 p-3">
      <div className="min-w-[220px] flex-1">
        <label className="label">{t('Resolution note (optional)')}</label>
        <input className="input" value={resolution} maxLength={500} onChange={(e) => setResolution(e.target.value)} autoFocus placeholder={t('What action was taken?')} />
      </div>
      <button className="btn-primary px-3 py-1.5 text-xs" disabled={m.isPending} onClick={() => m.mutate('RESOLVED')}>
        {m.isPending && m.variables === 'RESOLVED' ? <Spinner /> : <Check size={12} />} {t('Resolve')}
      </button>
      <button className="btn-secondary px-3 py-1.5 text-xs" disabled={m.isPending} onClick={() => m.mutate('DISMISSED')}>
        {m.isPending && m.variables === 'DISMISSED' ? <Spinner /> : <X size={12} />} {t('Dismiss')}
      </button>
      <button className="btn-ghost px-2 py-1.5 text-xs" onClick={onClose}>{t('Cancel')}</button>
    </div>
  );
}

export default function AdminReportsPage() {
  const t = useT();
  const me = useAuth((s) => s.user);
  const [status, setStatus] = useState<ReportStatus>('OPEN');
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['admin', 'reports', status], queryFn: () => api<{ items: Report[] }>(`/admin/reports?status=${status}`), refetchInterval: status === 'OPEN' ? 30_000 : false });
  const canResolve = can(me?.role, 'resolveReport');

  return (
    <div>
      <PageHeader title={t('Reports')} subtitle={t('User reports about players, clans, projects and messages.')} actions={<Tabs items={[{ key: 'OPEN', label: t('Open') }, { key: 'RESOLVED', label: t('Resolved') }, { key: 'DISMISSED', label: t('Dismissed') }]} value={status} onChange={setStatus} />} />
      {q.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> {t('Loading reports…')}</div>
      ) : q.error ? (
        <Empty title={t('Could not load reports')} body={errorMessage(q.error)} action={<button className="btn-secondary" onClick={() => void q.refetch()}>{t('Retry')}</button>} />
      ) : q.data && q.data.items.length === 0 ? (
        <Empty title={status === 'OPEN' ? t('No open reports') : t('No {status} reports', { status: t(status.toLowerCase()) })} body={status === 'OPEN' ? t('The queue is clear.') : undefined} />
      ) : (
        <ul className="space-y-3">
          {q.data?.items.map((r) => {
            const href = targetHref(r);
            return (
              <li key={r.id} className="card p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-300"><Flag size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="badge">{t(r.targetType)}</span>
                      {href ? (
                        <Link href={href} className="font-mono text-xs text-slate-200 hover:text-ember-300">{r.targetId}</Link>
                      ) : (
                        <span className="font-mono text-xs text-slate-200">{r.targetId}</span>
                      )}
                      <StatusBadge value={r.status} />
                      <span className="text-xs text-slate-500">
                        {t('by {username}', { username: r.reporter.username })} · {fmtDate(r.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{r.reason}</p>
                    {r.status !== 'OPEN' && (
                      <p className="mt-2 text-xs text-slate-500">
                        {t(r.status.toLowerCase())} {fmtDate(r.resolvedAt)}
                        {r.resolution ? ` — ${r.resolution}` : ''}
                      </p>
                    )}
                    {canResolve && r.status === 'OPEN' && (openId === r.id ? <ResolveForm report={r} onClose={() => setOpenId(null)} /> : (
                      <button className="btn-secondary mt-3 px-3 py-1.5 text-xs" onClick={() => setOpenId(r.id)}>{t('Resolve / dismiss')}</button>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
