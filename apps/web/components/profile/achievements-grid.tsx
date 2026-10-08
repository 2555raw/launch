'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Check, Gem, Sparkles } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { ProgressBar } from '@/components/ui/progress';
import { Spinner, fmt } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

/** Shape of packages/game-core progression.service listAchievements(). */
export interface AchievementItem {
  key: string;
  name: string;
  description: string;
  tier: number;
  maxTier: number;
  progress: number;
  target: number;
  reward: { gems: number; xp: number };
  completed: boolean;
  claimable: boolean;
  finished: boolean;
}

export function AchievementsGrid({ achievements, readOnly, queryKey }: { achievements: AchievementItem[]; readOnly?: boolean; queryKey?: unknown[] }) {
  const qc = useQueryClient();
  const claim = useMutation({
    mutationFn: (key: string) => api<{ reward: { gems: number; xp: number; tier: number }; achievements: AchievementItem[] }>(`/game/achievements/${key}/claim`, { method: 'POST' }),
    onSuccess: (data) => {
      toast.success('Reward claimed', `+${data.reward.gems} gems · +${data.reward.xp} xp`);
      if (queryKey) void qc.invalidateQueries({ queryKey });
      void qc.invalidateQueries({ queryKey: ['village'] });
    },
    onError: (e) => toast.error('Could not claim', errorMessage(e)),
  });
  const claimableCount = achievements.filter((a) => a.claimable).length;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-sm font-semibold text-white">
          <Award size={16} className="text-gold-400" /> Achievements
        </div>
        <span className="badge">
          {achievements.filter((a) => a.finished).length}/{achievements.length} complete
          {!readOnly && claimableCount > 0 && <span className="ml-1 text-mint-400">· {claimableCount} to claim</span>}
        </span>
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {achievements.map((a) => {
          const pct = a.finished ? 100 : Math.min(100, (a.progress / Math.max(1, a.target)) * 100);
          return (
            <li key={a.key} className={`rounded-xl border p-3 ${a.claimable && !readOnly ? 'border-mint-500/40 bg-mint-500/5' : a.finished ? 'border-gold-500/30 bg-gold-500/5' : 'border-white/[0.06] bg-white/[0.02]'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{a.name}</div>
                  <div className="text-xs text-slate-400">{a.description}</div>
                </div>
                <div className="flex shrink-0 gap-0.5" title={`Tier ${Math.min(a.tier, a.maxTier)} of ${a.maxTier}`}>
                  {Array.from({ length: a.maxTier }, (_, i) => (
                    <Sparkles key={i} size={12} className={i < a.tier ? 'text-gold-400' : 'text-slate-700'} />
                  ))}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-mono">
                  {a.finished ? 'All tiers complete' : `${fmt(Math.min(a.progress, a.target))} / ${fmt(a.target)}`}
                </span>
                <span>{Math.round(pct)}%</span>
              </div>
              <ProgressBar value={pct} max={100} color={a.finished ? 'gold' : a.claimable ? 'mint' : 'ember'} size="sm" className="mt-1" />
              <div className="mt-2 flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  {a.finished ? (
                    <>
                      <Check size={12} className="text-gold-400" /> Finished
                    </>
                  ) : (
                    <>
                      <Gem size={12} className="text-mint-400" /> {a.reward.gems} gems · {a.reward.xp} xp
                    </>
                  )}
                </span>
                {!readOnly && a.claimable && (
                  <button className="btn-primary px-3 py-1 text-xs" disabled={claim.isPending} onClick={() => claim.mutate(a.key)}>
                    {claim.isPending && claim.variables === a.key ? <Spinner /> : <Gem size={12} />} Claim
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
