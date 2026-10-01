import { cn } from "@/lib/cn";
import { LOGO_PATHS, LOGO_TRANSFORM, LOGO_VIEWBOX } from "@/lib/logo-paths";
import { site } from "@/lib/site";

/** The Chooser mark's paths, in its own coordinate space (see lib/logo-paths). */
export function LogoShapes({ fill = "currentColor" }: { fill?: string }) {
  return (
    <g transform={LOGO_TRANSFORM} fill={fill}>
      {LOGO_PATHS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}

/** The mark in the brand gradient (light blue to blue). Pass `mono` for a single colour (currentColor). */
export function LogoMark({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox={LOGO_VIEWBOX} aria-hidden="true" className={cn("size-7 shrink-0 text-bone", className)}>
      {!mono && (
        <defs>
          <linearGradient id="chooser-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#60a5fa" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
        </defs>
      )}
      <LogoShapes fill={mono ? "currentColor" : "url(#chooser-mark)"} />
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
