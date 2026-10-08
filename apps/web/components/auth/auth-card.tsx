'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-6">
      <Link href="/" className="mb-6 flex items-center gap-3 self-center">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-ember-400 to-elixir-500 font-display text-xl font-extrabold text-ink-950 shadow-glow">L</span>
        <div>
          <div className="font-display text-lg font-bold leading-tight text-white">Launch</div>
          <div className="text-[11px] text-slate-500">Emberhold · Launchpad</div>
        </div>
      </Link>
      <div className="card animate-rise p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-4 text-center text-sm text-slate-400">{footer}</div>}
    </div>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-rose-400">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500">
      <span className="h-px flex-1 bg-white/[0.08]" />
      {label}
      <span className="h-px flex-1 bg-white/[0.08]" />
    </div>
  );
}
