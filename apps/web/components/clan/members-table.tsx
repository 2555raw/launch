'use client';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Crown, UserX } from 'lucide-react';
import type { ClanRole } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useNow } from '@/lib/hooks';
import { ROLE_LABEL, assignableRoles, canKick } from './roles';
import type { ClanMember } from './types';
import { ago } from '@/components/ui/dates';
import { Spinner, fmt } from '@/components/ui/primitives';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';

const ROLE_STYLE: Record<ClanRole, string> = {
  LEADER: 'border-gold-500/40 text-gold-300',
  CO_LEADER: 'border-ember-500/40 text-ember-300',
  ELDER: 'border-elixir-500/40 text-elixir-400',
  MEMBER: '',
};

export function RoleBadge({ role }: { role: ClanRole }) {
  return (
    <span className={`badge gap-1 ${ROLE_STYLE[role]}`}>
      {role === 'LEADER' && <Crown size={10} />}
      {ROLE_LABEL[role]}
    </span>
  );
}

export function MembersTable({ members, myRole, myPlayerId }: { members: ClanMember[]; myRole: ClanRole; myPlayerId: string }) {
  const qc = useQueryClient();
  const now = useNow(30_000);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['clan'] });
  const kick = useMutation({
    mutationFn: (playerId: string) => api<{ ok: true }>(`/game/clans/members/${playerId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Member removed');
      refresh();
    },
    onError: (e) => toast.error('Could not remove member', errorMessage(e)),
  });
  const setRole = useMutation({
    mutationFn: ({ playerId, role }: { playerId: string; role: ClanRole }) => api<{ ok: true }>(`/game/clans/members/${playerId}/role`, { method: 'POST', json: { role } }),
    onSuccess: (_d, v) => {
      toast.success(v.role === 'LEADER' ? 'Leadership transferred' : `Role changed to ${ROLE_LABEL[v.role]}`);
      refresh();
    },
    onError: (e) => toast.error('Could not change role', errorMessage(e)),
  });

  const onRoleChange = (m: ClanMember, role: ClanRole) => {
    const msg = role === 'LEADER' ? `Hand leadership of the clan to ${m.name}? You will become a co-leader.` : `Change ${m.name}'s role to ${ROLE_LABEL[role]}?`;
    if (window.confirm(msg)) setRole.mutate({ playerId: m.playerId, role });
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-white">Members</h2>
        <span className="badge">{members.length}</span>
      </div>
      <Table className="mt-3">
        <thead>
          <tr>
            <Th>Player</Th>
            <Th className="text-right">Level</Th>
            <Th className="text-right">Trophies</Th>
            <Th>Role</Th>
            <Th className="text-right">Donated</Th>
            <Th className="text-right">Received</Th>
            <Th>Last seen</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const isSelf = m.playerId === myPlayerId;
            const roles = assignableRoles(myRole, m.role, isSelf);
            const kickable = canKick(myRole, m.role, isSelf);
            return (
              <Tr key={m.playerId} highlight={isSelf}>
                <Td>
                  <Link href={`/players/${m.playerId}`} className="font-semibold text-slate-100 hover:text-ember-300">
                    {m.name}
                  </Link>
                  {isSelf && <span className="ml-2 text-[10px] uppercase text-slate-500">you</span>}
                </Td>
                <Td className="text-right font-mono">{m.level}</Td>
                <Td className="text-right font-mono text-gold-300">{fmt(m.trophies)}</Td>
                <Td>
                  <RoleBadge role={m.role} />
                </Td>
                <Td className="text-right font-mono text-mint-400">{fmt(m.donated)}</Td>
                <Td className="text-right font-mono">{fmt(m.received)}</Td>
                <Td className="text-xs text-slate-400">{ago(m.lastSeenAt, now)}</Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {roles.length > 0 && (
                      <select className="input w-auto py-1 text-xs" value="" onChange={(e) => e.target.value && onRoleChange(m, e.target.value as ClanRole)} disabled={setRole.isPending} aria-label={`Change role of ${m.name}`}>
                        <option value="">Change role…</option>
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r === 'LEADER' ? 'Make leader' : `Set ${ROLE_LABEL[r]}`}
                          </option>
                        ))}
                      </select>
                    )}
                    {kickable && (
                      <button
                        className="btn-ghost p-1.5 text-slate-400 hover:text-rose-300"
                        title={`Remove ${m.name} from the clan`}
                        disabled={kick.isPending}
                        onClick={() => {
                          if (window.confirm(`Remove ${m.name} from the clan?`)) kick.mutate(m.playerId);
                        }}
                      >
                        {kick.isPending && kick.variables === m.playerId ? <Spinner /> : <UserX size={14} />}
                      </button>
                    )}
                  </div>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
