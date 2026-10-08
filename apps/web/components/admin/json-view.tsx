'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/** Compact, expandable JSON block for metadata / raw payload columns. */
export function JsonView({ value, label = 'details', defaultOpen = false }: { value: unknown; label?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (value === null || value === undefined) return <span className="text-xs text-slate-600">—</span>;
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const short = text.length > 60 ? `${text.slice(0, 60).replace(/\s+/g, ' ')}…` : text.replace(/\s+/g, ' ');
  return (
    <div className="max-w-md">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-left font-mono text-[11px] text-slate-400 hover:text-slate-200">
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {open ? label : short}
      </button>
      {open && <pre className="scroll-thin mt-1 max-h-72 overflow-auto rounded-lg border border-white/[0.06] bg-ink-950/80 p-2 font-mono text-[11px] leading-relaxed text-slate-300">{text}</pre>}
    </div>
  );
}
