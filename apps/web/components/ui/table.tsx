'use client';
import clsx from 'clsx';
import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('scroll-thin w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[560px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={clsx('border-b border-white/[0.06] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500', className)} {...rest}>
      {children}
    </th>
  );
}

export function Td({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={clsx('border-b border-white/[0.04] px-3 py-2 align-middle text-slate-200', className)} {...rest}>
      {children}
    </td>
  );
}

export function Tr({ className, children, highlight }: { className?: string; children: ReactNode; highlight?: boolean }) {
  return <tr className={clsx('transition hover:bg-white/[0.03]', highlight && 'bg-ember-500/10 ring-1 ring-inset ring-ember-500/30', className)}>{children}</tr>;
}
