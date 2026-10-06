"use client";

import { ArrowUpRight, LayoutDashboard, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { useSession } from "@/components/providers/SessionProvider";
import { XLogo } from "@/components/ui/XLogo";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { cn } from "@/lib/cn";
import { X_HANDLE, X_URL } from "@/lib/social";

const APP = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/steps", label: "Upload steps", icon: Upload },
];
const ADMIN = { href: "/admin", label: "Admin panel", icon: ShieldCheck };
const SITE = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#rewards", label: "Rewards" },
  { href: "/#ranking", label: "Ranking" },
  { href: "/#leaderboard", label: "Payouts" },
  { href: "/#faq", label: "FAQ" },
];

/** Sidebar on desktop; on phones a top bar with the wallet and tabs. */
export function AppNav() {
  const pathname = usePathname();
  const { user } = useSession();
  const items = user?.role === "admin" ? [...APP, ADMIN] : APP;
  const current = items.find((i) => pathname.startsWith(i.href));

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/[0.07] bg-ink-900/70 px-4 py-5 backdrop-blur-xl lg:flex">
        <div className="px-2">
          <Logo />
        </div>

        <nav className="mt-9 space-y-1" aria-label="App">
          {items.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active ? "bg-lime-400/10 text-lime-300" : "text-white/65 hover:bg-white/5 hover:text-white",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="label mb-2 mt-9 px-3 !text-[10px]">Stepit</div>
        <nav className="space-y-0.5" aria-label="Site">
          {SITE.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="group flex items-center justify-between rounded-xl px-3 py-2 text-[13px] text-white/45 transition hover:bg-white/5 hover:text-white"
            >
              {n.label}
              <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-60" />
            </Link>
          ))}
        </nav>

        <a
          href={X_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-[12.5px] text-white/60 transition hover:border-lime-400/30 hover:text-white"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06] text-white">
            <XLogo className="h-3.5 w-3.5" />
          </span>
          <span className="leading-tight">
            Follow us on X
            <span className="block text-[11.5px] text-white/40">@{X_HANDLE}</span>
          </span>
        </a>
      </aside>

      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-ink-950/80 backdrop-blur-xl lg:ml-64">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="hidden items-center gap-2 text-sm text-white/50 lg:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-neon" /> {current?.label ?? "Stepit"}
          </div>
          <ConnectWallet size="sm" />
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden" aria-label="App">
          {items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium",
                pathname.startsWith(n.href) ? "bg-lime-400/10 text-lime-300" : "text-white/60",
              )}
            >
              <n.icon className="h-3.5 w-3.5" />
              {n.label}
            </Link>
          ))}
          <Link href="/" className="ml-auto flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-[13px] text-white/45">
            Home <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </header>
    </>
  );
}
