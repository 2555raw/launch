'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import type { ClanType } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { can } from '@/components/admin/permissions';
import { CLAN_TYPE_LABEL } from '@/components/clan/types';
import { fmtDate } from '@/components/ui/dates';
import { Empty, PageHeader, Spinner, fmt } from '@/components/ui/primitives';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

interface ClanRow {
  id: string;
  name: string;
  tag: string;
  type: ClanType;
  trophies: number;
  members: number;
  createdAt: string;
}

export default function AdminClansPage() {
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'clans'], queryFn: () => api<{ items: ClanRow[] }>('/admin/clans') });
  const del = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/admin/clans/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Clan deleted');
      void qc.invalidateQueries({ queryKey: ['admin', 'clans'] });
    },
    onError: (e) => toast.error('Delete failed', errorMessage(e)),
  });

  return (
    <div>
      <PageHeader title="Clans" subtitle="Newest clans first (up to 100)." />
      {q.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Loading clans…</div>
      ) : q.error ? (
        <Empty title="Could not load clans" body={errorMessage(q.error)} action={<button className="btn-secondary" onClick={() => void q.refetch()}>Retry</button>} />
      ) : q.data && q.data.items.length === 0 ? (
        <Empty title="No clans yet" />
      ) : (
        <div className="card p-2 sm:p-4">
          <Table>
            <thead>
              <tr>
                <Th>Clan</Th>
                <Th>Tag</Th>
                <Th>Type</Th>
                <Th className="text-right">Trophies</Th>
                <Th className="text-right">Members</Th>
                <Th>Created</Th>
                {can(me?.role, 'deleteClan') && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {q.data?.items.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <div className="font-semibold text-slate-100">{c.name}</div>
                    <div className="font-mono text-[10px] text-slate-600">{c.id}</div>
                  </Td>
                  <Td className="font-mono text-xs">[{c.tag}]</Td>
                  <Td><span className="badge">{CLAN_TYPE_LABEL[c.type]}</span></Td>
                  <Td className="text-right font-mono text-gold-300">{fmt(c.trophies)}</Td>
                  <Td className="text-right font-mono">{c.members}</Td>
                  <Td className="text-xs text-slate-400">{fmtDate(c.createdAt)}</Td>
                  {can(me?.role, 'deleteClan') && (
                    <Td className="text-right">
                      <button
                        className="btn-ghost px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                        disabled={del.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete clan ${c.name} [${c.tag}] with ${c.members} member(s)? This cannot be undone.`)) del.mutate(c.id);
                        }}
                      >
                        {del.isPending && del.variables === c.id ? <Spinner /> : <Trash2 size={12} />} Delete
                      </button>
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
