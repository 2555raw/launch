'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Search, Trophy, Users } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { ClanBadge } from './clan-badge';
import { CLAN_TYPE_LABEL, type ClanListItem } from './types';
import { Empty, Spinner, fmt } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

export function ClanBrowse({ myTrophies }: { myTrophies: number | undefined }) {
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const list = useQuery({ queryKey: ['clans', q], queryFn: () => api<{ clans: ClanListItem[]; createCost: number }>(`/game/clans?q=${encodeURIComponent(q)}&limit=50`) });
  const join = useMutation({
    mutationFn: (id: string) => api<{ clan: unknown }>(`/game/clans/${id}/join`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('You joined the clan');
      void qc.invalidateQueries({ queryKey: ['clan'] });
    },
    onError: (e) => toast.error('Could not join', errorMessage(e)),
  });

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-display text-sm font-semibold text-white">
          <Users size={16} className="text-elixir-400" /> Find a clan
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-8" placeholder="Search by name or tag" value={input} onChange={(e) => setInput(e.target.value)} />
        </div>
      </div>
      {list.isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
          <Spinner /> Searching…
        </div>
      ) : list.error ? (
        <p className="py-6 text-sm text-rose-300">{errorMessage(list.error)}</p>
      ) : list.data && list.data.clans.length === 0 ? (
        <div className="mt-3">
          <Empty title="No clans found" body={q ? `Nothing matches "${q}". Try another name or tag.` : 'No clans exist yet. Be the first to found one.'} />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-white/[0.05]">
          {list.data?.clans.map((c) => {
            const needsInvite = c.type !== 'OPEN';
            const tooFewTrophies = myTrophies !== undefined && myTrophies < c.requiredTrophies;
            const full = c.members >= 50;
            const reason = c.type === 'CLOSED' ? 'Closed' : needsInvite ? 'Invite only' : full ? 'Full' : tooFewTrophies ? `Needs ${fmt(c.requiredTrophies)} trophies` : null;
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                <ClanBadge badge={c.badge} tag={c.tag} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-100">{c.name}</span>
                    <span className="font-mono text-xs text-slate-500">[{c.tag}]</span>
                    <span className="badge gap-1">
                      {c.type !== 'OPEN' && <Lock size={10} />}
                      {CLAN_TYPE_LABEL[c.type]}
                    </span>
                  </div>
                  {c.description && <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{c.description}</p>}
                  <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1"><Trophy size={11} className="text-gold-400" /> {fmt(c.trophies)}</span>
                    <span className="flex items-center gap-1"><Users size={11} /> {c.members}/50</span>
                    {c.requiredTrophies > 0 && <span>Requires {fmt(c.requiredTrophies)} trophies</span>}
                  </div>
                </div>
                <button className="btn-secondary px-3 py-1.5 text-xs" disabled={!!reason || join.isPending} title={reason ?? undefined} onClick={() => join.mutate(c.id)}>
                  {join.isPending && join.variables === c.id ? <Spinner /> : null}
                  {reason ?? 'Join'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
