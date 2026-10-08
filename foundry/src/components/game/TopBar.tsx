"use client";

import Link from "next/link";
import type { PublicUser } from "@/lib/types";

const DISCORD = process.env.NEXT_PUBLIC_DISCORD_URL ?? "";
const X_URL = process.env.NEXT_PUBLIC_X_URL ?? "";

/** Site-wide top bar: brand block, community links, docs and privacy, then account. */
export function TopBar({ user, onLogout, symbol, slug }: { user: PublicUser | null; onLogout?: () => void; symbol?: string; slug?: string }) {
  return (
    <header className="topnav">
      <Link href="/" className="topnav-brand" title="FOUNDRY launch">
        LAUNCH
      </Link>
      <span className="topnav-title">FOUNDRY<span className="hidden sm:inline text-slate-500"> · Mine · Burn · Launch</span></span>
      <ExtLink href={DISCORD} label="Discord" icon={<DiscordIcon />} />
      <ExtLink href={X_URL} label="X" icon={<XIcon />} />
      <Link href="/docs" className="topnav-link">Docs</Link>
      <Link href="/privacy" className="topnav-link">Privacy</Link>
      <span className="flex-1" />
      <Link href="/" className="topnav-link">Game</Link>
      <Link href={slug ? `/project/${slug}` : "/project"} className="topnav-link">{symbol ? `$${symbol}` : "Project"}</Link>
      {user?.role === "ADMIN" && <Link href="/admin" className="topnav-link text-brand-soft">Admin</Link>}
      {user && (
        <span className="ml-1 flex items-center gap-2 border-l border-white/10 pl-3 text-sm">
          <span className="font-display font-semibold text-slate-200">{user.username}</span>
          {onLogout && <button onClick={onLogout} className="text-xs text-slate-500 hover:text-slate-200">sign out</button>}
        </span>
      )}
    </header>
  );
}

function ExtLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  if (!href) {
    return (
      <span className="topnav-link cursor-default opacity-50" title={`${label} link not configured yet`}>
        {icon}
        <span className="hidden md:inline">{label}</span>
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer" className="topnav-link" title={label}>
      {icon}
      <span className="hidden md:inline">{label}</span>
    </a>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M19.6 5.4A16 16 0 0 0 15.7 4l-.5 1a15 15 0 0 0-6.4 0l-.5-1a16 16 0 0 0-3.9 1.4C2 9.2 1.4 12.9 1.7 16.5a16 16 0 0 0 4.8 2.4l1-1.6c-.6-.2-1.1-.5-1.6-.8l.4-.3a11.4 11.4 0 0 0 11.4 0l.4.3c-.5.3-1 .6-1.6.8l1 1.6a16 16 0 0 0 4.8-2.4c.4-4.2-.7-7.8-2.7-11.1ZM8.7 14.3c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Zm6.6 0c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M17.5 3h3l-7 8 8.2 10h-6.4l-5-6.5L4.6 21h-3l7.5-8.6L1.3 3h6.5l4.5 6 5.2-6Zm-1.1 16.2h1.7L7.1 4.7H5.3l11.1 14.5Z" />
    </svg>
  );
}
