import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

/**
 * The Picker mark: a square whose four sides each carry a half-disc and whose
 * corners are scooped out. Drawn on a 100-unit square; the half-discs reach
 * 24 units past each edge, hence the -24…124 view box.
 */

export function LogoShapes({ fill = "currentColor" }: { fill?: string }) {
  const corner = "M0 0H26A26 26 0 0 1 0 26Z";
  const half = "M26 0A24 24 0 0 1 74 0Z";
  return (
    <g fill={fill}>
      {[0, 90, 180, 270].map((r) => (
        <g key={r} transform={`rotate(${r} 50 50)`}>
          <path d={corner} />
          <path d={half} />
        </g>
      ))}
    </g>
  );
}

/** The mark in the brand gradient (blue to sky). Pass `mono` for a single colour (currentColor). */
export function LogoMark({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox="-24 -24 148 148" aria-hidden="true" className={cn("size-7 shrink-0 text-bone", className)}>
      {!mono && (
        <defs>
          <linearGradient id="picker-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b82f6" />
            <stop offset="1" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
      )}
      <LogoShapes fill={mono ? "currentColor" : "url(#picker-mark)"} />
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
