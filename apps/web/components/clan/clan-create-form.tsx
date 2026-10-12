'use client';
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Flag, Info } from 'lucide-react';
import type { ClanType } from '@launch/types';
import { api, errorMessage } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { BADGE_KEYS, ClanBadge } from './clan-badge';
import { CLAN_TYPE_LABEL } from './types';
import { fieldErrors, isValidationError } from '@/components/ui/api-errors';
import { Field } from '@/components/auth/auth-card';
import { Spinner, fmt } from '@/components/ui/primitives';
import { toast } from '@/components/ui/toast';

export function ClanCreateForm({ gold, hasClanHall }: { gold: number | undefined; hasClanHall: boolean | undefined }) {
  const t = useT();
  const qc = useQueryClient();
  const costQuery = useQuery({ queryKey: ['clans', ''], queryFn: () => api<{ clans: unknown[]; createCost: number }>('/game/clans?q=&limit=50') });
  const cost = costQuery.data?.createCost;
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ClanType>('OPEN');
  const [requiredTrophies, setRequiredTrophies] = useState(0);
  const [badge, setBadge] = useState<string>(BADGE_KEYS[0]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () => api<{ clan: unknown }>('/game/clans', { method: 'POST', json: { name: name.trim(), tag: tag.trim().toUpperCase(), description: description.trim() || undefined, type, requiredTrophies, badge } }),
    onSuccess: () => {
      toast.success(t('Clan founded'), t('{name} [{tag}] is live.', { name: name.trim(), tag: tag.trim().toUpperCase() }));
      void qc.invalidateQueries({ queryKey: ['clan'] });
      void qc.invalidateQueries({ queryKey: ['village'] });
    },
    onError: (e) => {
      setErrors(fieldErrors(e));
      toast.error(t('Could not create clan'), isValidationError(e) ? t('Check the highlighted fields.') : errorMessage(e));
    },
  });

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    setErrors({});
    create.mutate();
  };
  const cannotAfford = cost !== undefined && gold !== undefined && gold < cost;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 font-display text-sm font-semibold text-white">
        <Flag size={16} className="text-gold-400" /> {t('Found a clan')}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="badge gap-1 border-gold-500/30 text-gold-300">
          <Coins size={11} /> {cost !== undefined ? t('Costs {n} gold', { n: fmt(cost) }) : t('Costs …')}
          {gold !== undefined && <span className="text-slate-500">{t('(you have {n})', { n: fmt(gold) })}</span>}
        </span>
        <span className={`badge gap-1 ${hasClanHall === false ? 'border-rose-500/30 text-rose-300' : ''}`}>
          <Info size={11} /> {hasClanHall === false ? t('Requires a Clan Hall — build one in your village first') : t('Requires a Clan Hall')}
        </span>
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label={t('Name')} error={errors.name} hint={t('3–24 characters')}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} required />
          </Field>
          <Field label={t('Tag')} error={errors.tag} hint={t('2–6 letters/digits')}>
            <input className="input font-mono uppercase" value={tag} onChange={(e) => setTag(e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6))} maxLength={6} required />
          </Field>
        </div>
        <Field label={t('Description')} error={errors.description}>
          <textarea className="input min-h-[72px]" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder={t('What is your clan about?')} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('Type')} error={errors.type}>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as ClanType)}>
              {(Object.keys(CLAN_TYPE_LABEL) as ClanType[]).map((k) => (
                <option key={k} value={k}>
                  {t(CLAN_TYPE_LABEL[k])}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('Required trophies')} error={errors.requiredTrophies}>
            <input className="input font-mono" type="number" min={0} max={100000} value={requiredTrophies} onChange={(e) => setRequiredTrophies(Math.max(0, Math.min(100000, Math.floor(Number(e.target.value) || 0))))} />
          </Field>
        </div>
        <div>
          <label className="label">{t('Badge')}</label>
          <div className="flex flex-wrap gap-2">
            {BADGE_KEYS.map((k) => (
              <button type="button" key={k} onClick={() => setBadge(k)} className={`rounded-2xl p-0.5 ring-2 transition ${badge === k ? 'ring-ember-400' : 'ring-transparent hover:ring-white/20'}`} aria-label={k}>
                <ClanBadge badge={k} tag={tag || '?'} size="sm" />
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={create.isPending || !name.trim() || tag.trim().length < 2 || cannotAfford || hasClanHall === false} title={cannotAfford ? t('Not enough gold') : hasClanHall === false ? t('Build a Clan Hall first') : undefined}>
          {create.isPending ? <Spinner /> : <Flag size={16} />}
          {cannotAfford ? t('Not enough gold') : hasClanHall === false ? t('Clan Hall required') : cost !== undefined ? t('Found clan for {n} gold', { n: fmt(cost) }) : t('Found clan')}
        </button>
      </form>
    </div>
  );
}
