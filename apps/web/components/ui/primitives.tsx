'use client';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} size={16} />;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-white md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center p-10 text-center">
      <div className="font-display text-lg font-semibold text-slate-100">{title}</div>
      {body && <p className="mt-1 max-w-md text-sm text-slate-400">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: 'gold' | 'elixir' | 'ember' | 'mint' }) {
  const color = accent === 'gold' ? 'text-gold-400' : accent === 'elixir' ? 'text-elixir-400' : accent === 'ember' ? 'text-ember-400' : accent === 'mint' ? 'text-mint-400' : 'text-white';
  return (
    <div className="stat">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 font-display text-xl font-bold ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function fmt(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return 'Data unavailable';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return 'Data unavailable';
  if (n < 0.01 && n > 0) return `$${n.toPrecision(3)}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 4 : 2 })}`;
}

export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function timeLeft(iso: string | null, now = Date.now()): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'done';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function shortAddr(a: string, n = 4): string {
  return a.length > n * 2 + 3 ? `${a.slice(0, n)}…${a.slice(-n)}` : a;
}
