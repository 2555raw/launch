'use client';
import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { JsonView } from '@/components/admin/json-view';
import { fmtDate } from '@/components/ui/dates';
import { Empty, PageHeader, Spinner } from '@/components/ui/primitives';
import { Table, Td, Th, Tr } from '@/components/ui/table';

interface AuditRow {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
  actor: { username: string } | null;
}

const ACTION_TONE = (a: string) => (a.startsWith('admin.') ? 'text-ember-300' : a.startsWith('auth.') ? 'text-sky-300' : 'text-slate-200');

export default function AdminLogsPage() {
  const [input, setInput] = useState('');
  const [action, setAction] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setAction(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);
  const q = useInfiniteQuery({
    queryKey: ['admin', 'audit-logs', action],
    queryFn: ({ pageParam }) => api<{ items: AuditRow[]; nextCursor: string | null }>(`/admin/audit-logs?limit=100&action=${encodeURIComponent(action)}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Every privileged or security-relevant action, newest first. Filter by action prefix (e.g. admin., auth.login)."
        actions={
          <div className="relative w-72">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input pl-8 font-mono" placeholder="action prefix" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
        }
      />
      {q.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Loading audit log…</div>
      ) : q.error ? (
        <Empty title="Could not load audit log" body={errorMessage(q.error)} action={<button className="btn-secondary" onClick={() => void q.refetch()}>Retry</button>} />
      ) : rows.length === 0 ? (
        <Empty title="No log entries" body={action ? `Nothing starts with "${action}".` : undefined} />
      ) : (
        <div className="card p-2 sm:p-4">
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Target</Th>
                <Th>IP</Th>
                <Th>Metadata</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <Tr key={l.id}>
                  <Td className="whitespace-nowrap text-xs text-slate-400">{fmtDate(l.createdAt)}</Td>
                  <Td className="text-xs">
                    {l.actor?.username ?? <span className="text-slate-600">system</span>}
                    {l.actorUserId && <div className="font-mono text-[10px] text-slate-600">{l.actorUserId}</div>}
                  </Td>
                  <Td className={`font-mono text-xs ${ACTION_TONE(l.action)}`}>{l.action}</Td>
                  <Td className="font-mono text-[11px] text-slate-400">
                    {l.targetType ? (
                      <>
                        <span className="text-slate-500">{l.targetType}</span> {l.targetId}
                      </>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td className="font-mono text-[11px] text-slate-500">{l.ip ?? '—'}</Td>
                  <Td><JsonView value={l.metadata} label="metadata" /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {q.hasNextPage && (
            <div className="mt-3 text-center">
              <button className="btn-secondary" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                {q.isFetchingNextPage ? <Spinner /> : null} Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
