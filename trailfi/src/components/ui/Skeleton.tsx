import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-xl bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(255,255,255,0.09),rgba(255,255,255,0.04))] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white/40">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 18l5-8 4 5 3-4 4 7" />
        </svg>
      </div>
      <p className="font-medium text-white/80">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-white/50">{children}</div>}
    </div>
  );
}
