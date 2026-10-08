'use client';
import clsx from 'clsx';

const COLORS = {
  ember: 'from-ember-500 to-ember-300',
  elixir: 'from-elixir-600 to-elixir-400',
  gold: 'from-gold-500 to-gold-300',
  mint: 'from-mint-500 to-mint-400',
  slate: 'from-slate-500 to-slate-300',
} as const;

export function ProgressBar({ value, max, color = 'ember', className, size = 'md' }: { value: number; max: number; color?: keyof typeof COLORS; className?: string; size?: 'sm' | 'md' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={clsx('w-full overflow-hidden rounded-full bg-white/[0.06]', size === 'sm' ? 'h-1.5' : 'h-2.5', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={clsx('h-full rounded-full bg-gradient-to-r transition-[width] duration-500', COLORS[color])} style={{ width: `${pct}%` }} />
    </div>
  );
}
