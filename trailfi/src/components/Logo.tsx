import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { MARK_H, MARK_PATH, MARK_ROUND, MARK_W } from "@/lib/brand";

/** The Stepit mark on its own, in lime. */
export function Mark({ className }: { className?: string }) {
  // Each copy gets its own gradient id: a shared id breaks when the first copy sits in a hidden element.
  const g = `mk-g-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox={`-6 -6 ${MARK_W + 12} ${MARK_H + 12}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d8ff9c" />
          <stop offset="1" stopColor="#b2f047" />
        </linearGradient>
      </defs>
      <path d={MARK_PATH} fill={`url(#${g})`} stroke={`url(#${g})`} strokeWidth={MARK_ROUND} strokeLinejoin="round" />
    </svg>
  );
}

/** The mark in a square box, lime with no background, used next to the wordmark. */
export function LogoMark({ className }: { className?: string }) {
  const g = `tf-g-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox={`-6 ${-(MARK_W - MARK_H) / 2 - 6} ${MARK_W + 12} ${MARK_W + 12}`} className={cn("h-8 w-8", className)} aria-hidden>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d8ff9c" />
          <stop offset="1" stopColor="#b2f047" />
        </linearGradient>
      </defs>
      <path d={MARK_PATH} fill={`url(#${g})`} stroke={`url(#${g})`} strokeWidth={MARK_ROUND} strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Stepit home">
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
      <span className="font-display text-[19px] font-bold tracking-tight">
        Step<span className="text-lime-400">it</span>
      </span>
    </Link>
  );
}

/** The mark as a one-colour icon (takes the text colour), used wherever the site shows "steps". */
export function MarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox={`-6 ${-(MARK_W - MARK_H) / 2 - 6} ${MARK_W + 12} ${MARK_W + 12}`} className={cn("h-4 w-4", className)} aria-hidden>
      <path d={MARK_PATH} fill="currentColor" stroke="currentColor" strokeWidth={MARK_ROUND} strokeLinejoin="round" />
    </svg>
  );
}
