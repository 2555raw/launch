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
      <path d="M5.5 22.5 12.5 11l4.3 6.4 3-4.4 6.7 9.5" fill="none" stroke="url(#tf-g)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M8 26.2h16" stroke="#c4fb6d" strokeOpacity="0.55" strokeWidth="1.6" strokeDasharray="1.5 2.6" strokeLinecap="round" />
      <circle cx="19.8" cy="13" r="1.9" fill="#5dff9d" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="TrailFi home">
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105" />
      <span className="font-display text-[19px] font-bold tracking-tight">
        Trail<span className="text-lime-400">Fi</span>
      </span>
    </Link>
  );
}
