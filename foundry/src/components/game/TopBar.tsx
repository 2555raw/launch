"use client";

import Link from "next/link";
import type { PublicUser } from "@/lib/types";
import { Flame } from "@/components/ui/Icons";

export function TopBar({ user, onLogout, symbol, slug }: { user: PublicUser | null; onLogout?: () => void; symbol?: string; slug?: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-3">
      <Link href="/" className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-brand/20 text-brand-soft"><Flame className="h-5 w-5" /></span>
        <span className="font-display text-2xl font-bold tracking-[0.25em] text-slate-100">FOUNDRY</span>
        <span className="hidden text-xs uppercase tracking-[0.2em] text-slate-500 sm:inline">Mine · Burn · Launch</span>
      </Link>
      <nav className="flex items-center gap-1 text-sm">
        <Link href="/" className="rounded px-2.5 py-1 text-slate-300 hover:bg-white/[0.05]">Game</Link>
        <Link href={slug ? `/project/${slug}` : "/project"} className="rounded px-2.5 py-1 text-slate-300 hover:bg-white/[0.05]">{symbol ? `$${symbol} page` : "Project"}</Link>
        {user?.role === "ADMIN" && <Link href="/admin" className="rounded px-2.5 py-1 text-brand-soft hover:bg-white/[0.05]">Admin</Link>}
        {user && (
          <span className="ml-2 flex items-center gap-2 border-l border-white/10 pl-3">
            <span className="font-display font-semibold text-slate-200">{user.username}</span>
            {onLogout && <button onClick={onLogout} className="text-xs text-slate-500 hover:text-slate-200">sign out</button>}
          </span>
        )}
      </nav>
    </header>
  );
}
