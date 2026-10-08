'use client';

const TONES: Record<string, string> = {
  // user status / generic
  ACTIVE: 'border-mint-500/30 text-mint-400',
  BANNED: 'border-rose-500/30 text-rose-300',
  SUSPENDED: 'border-amber-500/30 text-amber-300',
  // roles
  ADMIN: 'border-ember-500/40 text-ember-300',
  MODERATOR: 'border-elixir-500/40 text-elixir-400',
  DEVELOPER: 'border-sky-500/40 text-sky-300',
  USER: '',
  // battles / transactions / projects / reports
  FINISHED: 'border-mint-500/30 text-mint-400',
  CONFIRMED: 'border-mint-500/30 text-mint-400',
  PUBLISHED: 'border-mint-500/30 text-mint-400',
  RESOLVED: 'border-mint-500/30 text-mint-400',
  ACTIVE_BATTLE: 'border-ember-500/30 text-ember-300',
  PENDING: 'border-amber-500/30 text-amber-300',
  VERIFYING: 'border-amber-500/30 text-amber-300',
  AWAITING_SIGNATURE: 'border-amber-500/30 text-amber-300',
  OPEN: 'border-amber-500/30 text-amber-300',
  DRAFT: 'text-slate-400',
  DISMISSED: 'text-slate-400',
  ABANDONED: 'text-slate-400',
  FAILED: 'border-rose-500/30 text-rose-300',
};

export function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="badge text-slate-500">—</span>;
  return <span className={`badge ${TONES[value] ?? ''}`}>{value.toLowerCase().replace(/_/g, ' ')}</span>;
}
