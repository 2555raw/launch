'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Hourglass, X } from 'lucide-react';
import type { ArmyDTO } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useNow } from '@/lib/hooks';
import { TroopAvatar, troopName } from './troop-avatar';
import { ProgressBar } from '@/components/ui/progress';
import { Spinner, timeLeft } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

export function TrainingQueue({ army }: { army: ArmyDTO }) {
  const now = useNow(1000);
  const qc = useQueryClient();
  const cancel = useMutation({
    mutationFn: (jobId: string) => api<{ army: ArmyDTO }>(`/game/army/training/${jobId}`, { method: 'DELETE' }),
    onSuccess: (data) => {
      qc.setQueryData(['army'], data);
      void qc.invalidateQueries({ queryKey: ['village'] });
      toast.success('Training cancelled', 'Elixir was refunded.');
    },
    onError: (e) => toast.error('Could not cancel', errorMessage(e)),
  });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-sm font-semibold text-white">
          <Hourglass size={16} className="text-elixir-400" /> Training queue
        </div>
        <span className="badge">{army.training.length} job{army.training.length === 1 ? '' : 's'}</span>
      </div>
      {army.training.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">The barracks are idle.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {army.training.map((job) => {
            const start = new Date(job.startedAt).getTime();
            const end = new Date(job.completesAt).getTime();
            const queued = start > now;
            const elapsed = Math.max(0, now - start);
            const total = Math.max(1, end - start);
            return (
              <li key={job.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2">
                <TroopAvatar type={job.troopType} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-semibold text-slate-100">
                      {job.count}× {troopName(job.troopType)}
                    </span>
                    <span className="font-mono text-xs text-slate-300">{queued ? 'queued' : timeLeft(job.completesAt, now)}</span>
                  </div>
                  <ProgressBar value={queued ? 0 : elapsed} max={total} color="elixir" size="sm" className="mt-1.5" />
                </div>
                <button
                  className="btn-ghost p-1.5 text-slate-400 hover:text-rose-300"
                  title="Cancel and refund"
                  disabled={cancel.isPending}
                  onClick={() => {
                    if (window.confirm(`Cancel training ${job.count}× ${troopName(job.troopType)}? The elixir will be refunded.`)) cancel.mutate(job.id);
                  }}
                >
                  {cancel.isPending && cancel.variables === job.id ? <Spinner /> : <X size={14} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
