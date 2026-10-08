'use client';
import clsx from 'clsx';
import { Shield } from 'lucide-react';

/**
 * Clan badges are stored as a short string key (default "shield-1"). We render the key as a
 * colored shield with the clan tag; unknown keys get a color derived from the key itself.
 */
export const BADGE_KEYS = ['shield-1', 'shield-2', 'shield-3', 'shield-4', 'shield-5', 'shield-6', 'shield-7', 'shield-8'] as const;

const GRADIENTS: Record<string, string> = {
  'shield-1': 'from-ember-400 to-ember-700',
  'shield-2': 'from-elixir-400 to-elixir-600',
  'shield-3': 'from-gold-300 to-gold-500',
  'shield-4': 'from-mint-400 to-emerald-700',
  'shield-5': 'from-sky-400 to-indigo-700',
  'shield-6': 'from-rose-400 to-rose-800',
  'shield-7': 'from-slate-300 to-slate-600',
  'shield-8': 'from-cyan-300 to-teal-700',
};

export function badgeGradient(key: string): string {
  if (GRADIENTS[key]) return GRADIENTS[key];
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Object.values(GRADIENTS)[h % Object.keys(GRADIENTS).length];
}

export function ClanBadge({ badge, tag, size = 'md', className }: { badge: string; tag?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const dim = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-20 w-20' : 'h-12 w-12';
  const text = size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-base' : 'text-[11px]';
  const icon = size === 'sm' ? 18 : size === 'lg' ? 48 : 28;
  return (
    <div className={clsx('relative grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br shadow-card', dim, badgeGradient(badge), className)} title={badge}>
      <Shield size={icon} className="text-ink-950/70" strokeWidth={2.2} />
      {tag && <span className={clsx('absolute font-display font-extrabold tracking-wide text-white drop-shadow', text)}>{tag.slice(0, 4)}</span>}
    </div>
  );
}
