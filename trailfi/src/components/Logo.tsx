import Link from "next/link";
import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden>
      <defs>
        <linearGradient id="tf-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d8ff9c" />
          <stop offset="1" stopColor="#5dff9d" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="9.5" fill="#071d14" stroke="rgba(196,251,109,0.35)" />
      {/* Two footprints, one step ahead of the other */}
      <g fill="url(#tf-g)" opacity="0.7">
        <ellipse cx="11" cy="20.3" rx="2.9" ry="4.3" transform="rotate(-12 11 20.3)" />
        <circle cx="9.1" cy="14.2" r="1.05" />
        <circle cx="11.1" cy="13.5" r="1.15" />
        <circle cx="13" cy="14.1" r="0.95" />
      </g>
      <g fill="url(#tf-g)">
        <ellipse cx="20.8" cy="14.6" rx="2.9" ry="4.3" transform="rotate(12 20.8 14.6)" />
        <circle cx="19.3" cy="8.5" r="1.05" />
        <circle cx="21.3" cy="7.9" r="1.15" />
        <circle cx="23.2" cy="8.6" r="0.95" />
      </g>
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
