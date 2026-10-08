'use client';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { STEPS } from './state';

export function Stepper({ current, maxReachable, onJump }: { current: number; maxReachable: number; onJump: (step: number) => void }) {
  return (
    <ol className="scroll-thin mb-6 flex gap-2 overflow-x-auto pb-1">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        const reachable = n <= maxReachable;
        return (
          <li key={label} className="shrink-0">
            <button
              type="button"
              disabled={!reachable || active}
              onClick={() => onJump(n)}
              className={clsx('flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition', active ? 'border-ember-500/60 bg-ember-500/15 text-ember-300' : done ? 'border-mint-500/30 text-mint-400 hover:bg-white/[0.04]' : 'border-white/[0.08] text-slate-500', !reachable && 'cursor-not-allowed')}
            >
              <span className={clsx('grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold', active ? 'bg-ember-500 text-ink-950' : done ? 'bg-mint-500/20 text-mint-400' : 'bg-white/[0.06] text-slate-400')}>{done ? <Check size={12} /> : n}</span>
              {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
