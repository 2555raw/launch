'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, Settings, Trophy, Users } from 'lucide-react';
import type { ClanRole } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { ClanBadge } from './clan-badge';
import { ROLE_LABEL, atLeast } from './roles';
import { CLAN_TYPE_LABEL, type ClanDetail } from './types';
import { Spinner, fmt } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

export function ClanHeader({ clan, role, settingsOpen, onToggleSettings }: { clan: ClanDetail; role: ClanRole; settingsOpen: boolean; onToggleSettings: () => void }) {
  const qc = useQueryClient();
  const leave = useMutation({
    mutationFn: () => api<{ disbanded: boolean }>('/game/clans/leave', { method: 'POST' }),
    onSuccess: (r) => {
      toast.success(r.disbanded ? 'Clan disbanded' : 'You left the clan');
      void qc.invalidateQueries({ queryKey: ['clan'] });
    },
    onError: (e) => toast.error('Could not leave', errorMessage(e)),
  });
  const confirmLeave = () => {
    const last = clan.memberCount <= 1;
    const msg = last ? `You are the last member. Leaving will disband ${clan.name}. Continue?` : role === 'LEADER' ? `Leave ${clan.name}? Leadership passes to the highest ranked member.` : `Leave ${clan.name}?`;
    if (window.confirm(msg)) leave.mutate();
  };

  return (
    <div className="card relative overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 bg-grid-faint bg-[size:24px_24px] opacity-60" />
      <div className="relative flex flex-wrap items-start gap-4">
        <ClanBadge badge={clan.badge} tag={clan.tag} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-white">{clan.name}</h1>
            <span className="font-mono text-sm text-slate-400">[{clan.tag}]</span>
            <span className="badge border-ember-500/30 text-ember-300">Your role: {ROLE_LABEL[role]}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="badge gap-1 border-gold-500/30 text-gold-300"><Trophy size={11} /> {fmt(clan.trophies)} trophies</span>
            <span className="badge gap-1"><Users size={11} /> {clan.memberCount}/50 members</span>
            <span className="badge">{CLAN_TYPE_LABEL[clan.type]}</span>
            {clan.requiredTrophies > 0 && <span className="badge">Requires {fmt(clan.requiredTrophies)} trophies</span>}
          </div>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">{clan.description || <span className="italic text-slate-500">No description yet.</span>}</p>
        </div>
        <div className="flex gap-2">
          {atLeast(role, 'CO_LEADER') && (
            <button className={settingsOpen ? 'btn-primary' : 'btn-secondary'} onClick={onToggleSettings}>
              <Settings size={16} /> Settings
            </button>
          )}
          <button className="btn-ghost text-rose-300 hover:bg-rose-500/10" onClick={confirmLeave} disabled={leave.isPending}>
            {leave.isPending ? <Spinner /> : <LogOut size={16} />} Leave
          </button>
        </div>
      </div>
    </div>
  );
}
