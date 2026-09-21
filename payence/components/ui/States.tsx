import type { ReactNode } from "react";
import { Button } from "./Button";

/** The empty state. Never a blank panel: it says what would appear and how to make it appear. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && (
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-hair bg-shell text-muted">
          {icon}
        </div>
      )}
      <p className="text-[17px] font-semibold tracking-tight">{title}</p>
      <p className="mt-2 max-w-[38ch] text-[14px] leading-relaxed text-muted">{body}</p>
      {action && (
        <Button href={action.href} size="md" className="mt-6">
          {action.label}
        </Button>
      )}
    </div>
  );
}

/** The error state, for a panel that could not load. Polished, not an alert(). */
export function ErrorState({ title, body, retry }: { title: string; body: string; retry?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-danger/25 bg-danger-soft text-danger">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 8v5M12 16.5v.01" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </div>
      <p className="text-[17px] font-semibold tracking-tight">{title}</p>
      <p className="mt-2 max-w-[42ch] text-[14px] leading-relaxed text-muted">{body}</p>
      {retry && <div className="mt-6">{retry}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** The list skeleton every transaction list falls back to while streaming. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-hair" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
