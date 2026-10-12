'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, UserPlus } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import type { PlayerSearchResult } from './types';
import { Spinner, fmt } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

export function InviteSearch() {
  const t = useT();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [invited, setInvited] = useState<Set<string>>(new Set());
  useEffect(() => {
    const timer = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const search = useQuery({ queryKey: ['players', 'search', q], queryFn: () => api<{ players: PlayerSearchResult[] }>(`/game/players/search?q=${encodeURIComponent(q)}`), enabled: q.length >= 2 });
  const invite = useMutation({
    mutationFn: (playerId: string) => api<{ invite: unknown }>('/game/clans/invite', { method: 'POST', json: { playerId } }),
    onSuccess: (_d, playerId) => {
      setInvited((s) => new Set(s).add(playerId));
      toast.success(t('Invite sent'));
    },
    onError: (e) => toast.error(t('Could not invite'), errorMessage(e)),
  });

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 font-display text-sm font-semibold text-white">
        <UserPlus size={16} className="text-mint-400" /> {t('Invite players')}
      </div>
      <div className="relative mt-3">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-8" placeholder={t('Search players by name (2+ letters)')} value={input} onChange={(e) => setInput(e.target.value)} />
      </div>
      {q.length >= 2 && (
        <div className="scroll-thin mt-2 max-h-64 overflow-y-auto">
          {search.isLoading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
              <Spinner /> {t('Searching…')}
            </div>
          ) : search.error ? (
            <p className="py-2 text-xs text-rose-300">{errorMessage(search.error)}</p>
          ) : search.data?.players.length === 0 ? (
            <p className="py-2 text-xs text-slate-500">{t('No players match "{q}".', { q })}</p>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {search.data?.players.map((p) => {
                const done = invited.has(p.id);
                return (
                  <li key={p.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-100">{p.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {t('lvl {level} · {trophies} trophies', { level: p.level, trophies: fmt(p.trophies) })}{p.clan ? t(' · in {name} [{tag}]', { name: p.clan.name, tag: p.clan.tag }) : ''}
                      </div>
                    </div>
                    <button className="btn-secondary px-2 py-1 text-xs" disabled={!!p.clan || done || invite.isPending} onClick={() => invite.mutate(p.id)} title={p.clan ? t('Already in a clan') : undefined}>
                      {invite.isPending && invite.variables === p.id ? <Spinner /> : null}
                      {p.clan ? t('In a clan') : done ? t('Invited') : t('Invite')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
