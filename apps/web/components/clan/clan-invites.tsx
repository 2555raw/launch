'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Mail, X } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { ClanBadge } from './clan-badge';
import type { ClanInvite } from './types';
import { ago } from '@/components/ui/dates';
import { Spinner } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

export function ClanInvites({ invites }: { invites: ClanInvite[] }) {
  const qc = useQueryClient();
  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => api<{ clan: unknown }>(`/game/clans/invites/${id}/respond`, { method: 'POST', json: { accept } }),
    onSuccess: (_d, v) => {
      toast.success(v.accept ? 'Welcome to the clan' : 'Invite declined');
      void qc.invalidateQueries({ queryKey: ['clan'] });
      void qc.invalidateQueries({ queryKey: ['village'] });
    },
    onError: (e) => toast.error('Could not respond to invite', errorMessage(e)),
  });

  if (invites.length === 0) return null;
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 font-display text-sm font-semibold text-white">
        <Mail size={16} className="text-ember-400" /> Pending invites <span className="badge">{invites.length}</span>
      </div>
      <ul className="mt-3 space-y-2">
        {invites.map((inv) => {
          const busy = respond.isPending && respond.variables?.id === inv.id;
          return (
            <li key={inv.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
              <ClanBadge badge={inv.clan.badge} tag={inv.clan.tag} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-100">
                  {inv.clan.name} <span className="font-mono text-xs text-slate-500">[{inv.clan.tag}]</span>
                </div>
                <div className="text-xs text-slate-500">Invited {ago(inv.createdAt)}</div>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary px-3 py-1.5 text-xs" disabled={respond.isPending} onClick={() => respond.mutate({ id: inv.id, accept: true })}>
                  {busy && respond.variables?.accept ? <Spinner /> : <Check size={14} />} Accept
                </button>
                <button className="btn-secondary px-3 py-1.5 text-xs" disabled={respond.isPending} onClick={() => respond.mutate({ id: inv.id, accept: false })}>
                  {busy && !respond.variables?.accept ? <Spinner /> : <X size={14} />} Decline
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
