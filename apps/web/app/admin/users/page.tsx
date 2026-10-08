'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Castle, Search, ShieldCheck } from 'lucide-react';
import type { Chain, UserRole, UserStatus } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { can } from '@/components/admin/permissions';
import { StatusBadge } from '@/components/admin/status-badge';
import { fmtDate } from '@/components/ui/dates';
import { Empty, PageHeader, Spinner, fmt, shortAddr } from '@/components/ui/primitives';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

interface AdminUser {
  id: string;
  email: string | null;
  username: string;
  role: UserRole;
  status: UserStatus;
  banReason: string | null;
  bannedUntil: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  player: { id: string; name: string; level: number; trophies: number } | null;
  wallets: Array<{ chain: Chain; address: string }>;
  projects: number;
}

const ROLES: UserRole[] = ['USER', 'MODERATOR', 'ADMIN', 'DEVELOPER'];

function BanForm({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [days, setDays] = useState<string>('');
  const ban = useMutation({
    mutationFn: () => api<{ ok: true }>(`/admin/users/${user.id}/ban`, { method: 'POST', json: { reason: reason.trim(), ...(days ? { days: Number(days) } : {}) } }),
    onSuccess: () => {
      toast.success(`${user.username} banned`);
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
    onError: (e) => toast.error('Ban failed', errorMessage(e)),
  });
  return (
    <form
      className="card animate-rise mb-4 flex flex-wrap items-end gap-3 border-rose-500/30 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim().length < 3) return toast.error('Reason required', 'Give at least 3 characters.');
        if (window.confirm(`Ban ${user.username}${days ? ` for ${days} day(s)` : ' permanently'}?`)) ban.mutate();
      }}
    >
      <div className="min-w-[240px] flex-1">
        <label className="label">Ban {user.username} — reason</label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoFocus placeholder="Why is this account being banned?" />
      </div>
      <div>
        <label className="label">Days (blank = permanent)</label>
        <input className="input w-32 font-mono" type="number" min={0} max={3650} value={days} onChange={(e) => setDays(e.target.value)} />
      </div>
      <button type="submit" className="btn-danger" disabled={ban.isPending}>
        {ban.isPending ? <Spinner /> : <Ban size={16} />} Ban
      </button>
      <button type="button" className="btn-ghost" onClick={onClose}>
        Cancel
      </button>
    </form>
  );
}

export default function AdminUsersPage() {
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const users = useInfiniteQuery({
    queryKey: ['admin', 'users', q],
    queryFn: ({ pageParam }) => api<{ items: AdminUser[]; nextCursor: string | null }>(`/admin/users?q=${encodeURIComponent(q)}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  const unban = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/admin/users/${id}/unban`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('User unbanned');
      refresh();
    },
    onError: (e) => toast.error('Unban failed', errorMessage(e)),
  });
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => api<{ ok: true }>(`/admin/users/${id}/role`, { method: 'POST', json: { role } }),
    onSuccess: (_d, v) => {
      toast.success(`Role set to ${v.role}`);
      refresh();
    },
    onError: (e) => toast.error('Role change failed', errorMessage(e)),
  });

  const rows = users.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Search by username, email or wallet address."
        actions={
          <div className="relative w-72">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input pl-8" placeholder="Search users" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
        }
      />
      {banTarget && <BanForm user={banTarget} onClose={() => setBanTarget(null)} />}
      {users.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Spinner /> Loading users…</div>
      ) : users.error ? (
        <Empty title="Could not load users" body={errorMessage(users.error)} action={<button className="btn-secondary" onClick={() => void users.refetch()}>Retry</button>} />
      ) : rows.length === 0 ? (
        <Empty title="No users found" body={q ? `Nothing matches "${q}".` : undefined} />
      ) : (
        <div className="card p-2 sm:p-4">
          <Table>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Player</Th>
                <Th>Wallets</Th>
                <Th className="text-right">Projects</Th>
                <Th>Joined</Th>
                <Th>Last login</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <Tr key={u.id} highlight={isSelf}>
                    <Td>
                      <div className="font-semibold text-slate-100">{u.username}</div>
                      <div className="text-xs text-slate-500">{u.email ?? 'wallet-only'}</div>
                      <div className="font-mono text-[10px] text-slate-600">{u.id}</div>
                    </Td>
                    <Td>
                      {can(me?.role, 'changeRole') && !isSelf ? (
                        <select className="input w-auto py-1 text-xs" value={u.role} disabled={setRole.isPending} onChange={(e) => window.confirm(`Change ${u.username}'s role to ${e.target.value}?`) ? setRole.mutate({ id: u.id, role: e.target.value as UserRole }) : undefined}>
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge value={u.role} />
                      )}
                    </Td>
                    <Td>
                      <StatusBadge value={u.status} />
                      {u.status === 'BANNED' && (
                        <div className="mt-1 max-w-[180px] text-[11px] text-slate-500">
                          {u.banReason}
                          {u.bannedUntil ? ` · until ${fmtDate(u.bannedUntil)}` : ' · permanent'}
                        </div>
                      )}
                    </Td>
                    <Td>
                      {u.player ? (
                        <Link href={`/admin/villages?playerId=${u.player.id}`} className="flex items-center gap-1 text-slate-100 hover:text-ember-300">
                          <Castle size={12} /> {u.player.name}
                          <span className="text-xs text-slate-500">
                            · lvl {u.player.level} · {fmt(u.player.trophies)}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </Td>
                    <Td className="font-mono text-[11px] text-slate-400">
                      {u.wallets.length === 0 ? '—' : u.wallets.map((w) => <div key={w.address}>{w.chain === 'SOLANA' ? 'SOL' : 'RH'} {shortAddr(w.address)}</div>)}
                    </Td>
                    <Td className="text-right font-mono">{u.projects}</Td>
                    <Td className="text-xs text-slate-400">{fmtDate(u.createdAt)}</Td>
                    <Td className="text-xs text-slate-400">{fmtDate(u.lastLoginAt)}</Td>
                    <Td className="text-right">
                      {can(me?.role, 'ban') && !isSelf && u.role !== 'ADMIN' && (
                        u.status === 'BANNED' ? (
                          <button className="btn-secondary px-2 py-1 text-xs" disabled={unban.isPending} onClick={() => window.confirm(`Unban ${u.username}?`) && unban.mutate(u.id)}>
                            {unban.isPending && unban.variables === u.id ? <Spinner /> : <ShieldCheck size={12} />} Unban
                          </button>
                        ) : (
                          <button className="btn-ghost px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10" onClick={() => setBanTarget(u)}>
                            <Ban size={12} /> Ban
                          </button>
                        )
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          {users.hasNextPage && (
            <div className="mt-3 text-center">
              <button className="btn-secondary" onClick={() => void users.fetchNextPage()} disabled={users.isFetchingNextPage}>
                {users.isFetchingNextPage ? <Spinner /> : null} Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
