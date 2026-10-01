"use client";

import { AlertTriangle, BarChart3, ClipboardCheck, Coins, Footprints, Inbox, ScrollText, Send, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Badge } from "@/components/ui/Badge";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { cn } from "@/lib/cn";
import { useAdminMeta } from "./hooks";

const NAV = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/requests", label: "Requests", icon: Inbox },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/steps", label: "Step review", icon: Footprints },
  { href: "/admin/rewards", label: "Rewards", icon: Coins },
  { href: "/admin/payouts", label: "Payouts", icon: Send },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data } = useAdminMeta();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-ink-950">
      <div className="pointer-events-none fixed -left-40 top-0 h-[500px] w-[500px] rounded-full bg-forest-600/15 blur-[140px]" />
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/[0.07] bg-ink-900/70 px-4 py-5 backdrop-blur-xl lg:flex">
        <div className="flex items-center justify-between px-2">
          <Logo />
          <Badge tone="lime">Admin</Badge>
        </div>
        <nav className="mt-8 flex-1 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive(n.href) ? "bg-lime-400/10 text-lime-300" : "text-white/60 hover:bg-white/5 hover:text-white",
              )}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
              {n.href === "/admin/requests" && data && data.payouts.requested > 0 && (
                <span className="ml-auto rounded-full bg-lime-400 px-2 py-0.5 font-mono text-[10px] font-bold text-forest-950">{data.payouts.requested}</span>
              )}
              {n.href === "/admin/steps" && data && data.stepsAwaitingReview > 0 && (
                <span className="ml-auto rounded-full bg-amber-400/15 px-2 py-0.5 font-mono text-[10px] text-amber-200">{data.stepsAwaitingReview}</span>
              )}
              {n.href === "/admin/payouts" && data && data.payouts.inFlight > 0 && (
                <span className="ml-auto rounded-full bg-sky-400/15 px-2 py-0.5 font-mono text-[10px] text-sky-200">{data.payouts.inFlight}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[11.5px] leading-relaxed text-white/45">
          <ClipboardCheck className="mb-1.5 h-4 w-4 text-lime-400" />
          Every action here is recorded in the audit log with your wallet address.
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-ink-950/80 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <Logo />
            </div>
            <div className="hidden items-center gap-2 text-sm text-white/50 lg:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-neon" /> Admin console
              {data?.demoMode && <Badge tone="amber">Demo mode</Badge>}
            </div>
            <ConnectWallet size="sm" />
          </div>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium",
                  isActive(n.href) ? "bg-lime-400/10 text-lime-300" : "text-white/60",
                )}
              >
                <n.icon className="h-3.5 w-3.5" />
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="relative px-4 py-8 sm:px-8">
          {data && !data.tokenReady && (
            <Link
              href="/admin/settings"
              className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.08] p-4 text-[13px] leading-relaxed text-amber-100/90 transition hover:border-amber-400/50"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>
                <strong className="font-semibold">Payout token not set for this network.</strong> The token address in Settings is not a
                contract on the payout network, so payouts are blocked. Open Settings and enter the token contract (for example USDG or
                $STEPIT on Robinhood Chain).
              </span>
            </Link>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
