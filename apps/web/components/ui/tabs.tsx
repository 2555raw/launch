'use client';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface TabItem<K extends string> {
  key: K;
  label: ReactNode;
  count?: number;
}

export function Tabs<K extends string>({ items, value, onChange, className }: { items: TabItem<K>[]; value: K; onChange: (k: K) => void; className?: string }) {
  return (
    <div className={clsx('scroll-thin flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-ink-900/60 p-1', className)} role="tablist">
      {items.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={clsx('flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition', value === t.key ? 'bg-ember-500/15 text-ember-300' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100')}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-white/[0.08] px-1.5 text-[10px] text-slate-300">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
