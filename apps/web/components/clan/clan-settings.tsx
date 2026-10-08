'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import type { ClanType } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { BADGE_KEYS, ClanBadge } from './clan-badge';
import { CLAN_TYPE_LABEL, type ClanDetail } from './types';
import { Field } from '@/components/auth/auth-card';
import { fieldErrors, isValidationError } from '@/components/ui/api-errors';
import { Spinner } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

export function ClanSettings({ clan, onSaved }: { clan: ClanDetail; onSaved: () => void }) {
  const qc = useQueryClient();
  const [description, setDescription] = useState(clan.description);
  const [type, setType] = useState<ClanType>(clan.type);
  const [requiredTrophies, setRequiredTrophies] = useState(clan.requiredTrophies);
  const [badge, setBadge] = useState(clan.badge);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const badges = BADGE_KEYS.includes(badge as (typeof BADGE_KEYS)[number]) ? [...BADGE_KEYS] : [badge, ...BADGE_KEYS];

  const save = useMutation({
    mutationFn: () => api<{ clan: ClanDetail }>('/game/clans', { method: 'PATCH', json: { description, type, requiredTrophies, badge } }),
    onSuccess: () => {
      toast.success('Clan settings saved');
      void qc.invalidateQueries({ queryKey: ['clan'] });
      onSaved();
    },
    onError: (e) => {
      setErrors(fieldErrors(e));
      toast.error('Could not save', isValidationError(e) ? 'Check the highlighted fields.' : errorMessage(e));
    },
  });
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    setErrors({});
    save.mutate();
  };

  return (
    <form onSubmit={submit} className="card animate-rise space-y-3 p-4">
      <h2 className="font-display text-sm font-semibold text-white">Clan settings</h2>
      <Field label="Description" error={errors.description}>
        <textarea className="input min-h-[72px]" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" error={errors.type}>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as ClanType)}>
            {(Object.keys(CLAN_TYPE_LABEL) as ClanType[]).map((t) => (
              <option key={t} value={t}>
                {CLAN_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Required trophies" error={errors.requiredTrophies}>
          <input className="input font-mono" type="number" min={0} max={100000} value={requiredTrophies} onChange={(e) => setRequiredTrophies(Math.max(0, Math.min(100000, Math.floor(Number(e.target.value) || 0))))} />
        </Field>
      </div>
      <div>
        <label className="label">Badge</label>
        <div className="flex flex-wrap gap-2">
          {badges.map((k) => (
            <button type="button" key={k} onClick={() => setBadge(k)} className={`rounded-2xl p-0.5 ring-2 transition ${badge === k ? 'ring-ember-400' : 'ring-transparent hover:ring-white/20'}`} aria-label={k}>
              <ClanBadge badge={k} tag={clan.tag} size="sm" />
            </button>
          ))}
        </div>
        {errors.badge && <p className="mt-1 text-xs text-rose-400">{errors.badge}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onSaved}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? <Spinner /> : <Save size={16} />} Save changes
        </button>
      </div>
    </form>
  );
}
