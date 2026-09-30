import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

/** The mark: a 2×2 grid of pads with one picked out of it. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <rect x="3" y="3" width="12" height="12" rx="3.5" fill="#F3EFE7" />
      <rect x="3" y="17" width="12" height="12" rx="3.5" fill="#F3EFE7" opacity="0.3" />
      <rect x="17" y="17" width="12" height="12" rx="3.5" fill="#F3EFE7" opacity="0.7" />
      <rect x="18" y="1.5" width="12" height="12" rx="3.5" fill="#FFFFFF" transform="rotate(8 24 7.5)" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && <span className="display text-[19px] font-semibold tracking-tight">{site.name}</span>}
    </span>
  );
}
