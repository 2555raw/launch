import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icons";
import { NavLinks, BottomNav } from "./Nav";
import { SIMULATED_CHAIN } from "@/lib/config";

export const USER_NAV = [
  { href: "/dashboard", label: "Home", icon: "home" as const },
  { href: "/wallet", label: "Wallet", icon: "wallet" as const },
  { href: "/pay", label: "Pay", icon: "scan" as const, primary: true },
  { href: "/transactions", label: "Activity", icon: "list" as const },
  { href: "/settings", label: "Settings", icon: "settings" as const },
];

/**
 * The app frame. On a phone it is a bottom bar with the pay action raised in the
 * middle, because paying is the one thing that has to be reachable with a thumb.
 * On a desktop it becomes a sidebar. The mobile layout is not a narrowed desktop.
 */
export function AppShell({
  children,
  user,
  unread,
}: {
  children: ReactNode;
  user: { name: string; handle: string };
  unread: number;
}) {
  return (
    <div className="min-h-dvh bg-canvas">
      {SIMULATED_CHAIN && <SimulationBanner />}
      <div className="mx-auto flex w-full max-w-app gap-8 px-0 md:px-8">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col py-8 md:flex">
          <Link href="/dashboard" className="mb-10 px-3 text-[19px] font-extrabold tracking-[-0.04em]">
            PAYENCE
          </Link>
          <NavLinks items={USER_NAV} />
          <div className="mt-auto space-y-1 px-1">
            <Link
              href="/notifications"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-muted transition-colors hover:bg-shell hover:text-ink"
            >
              <Icon.bell className="h-[18px] w-[18px]" />
              Notifications
              {unread > 0 && (
                <span className="ml-auto rounded-pill bg-coral px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link
              href="/merchant"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-muted transition-colors hover:bg-shell hover:text-ink"
            >
              <Icon.store className="h-[18px] w-[18px]" />
              Merchant
            </Link>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-hair bg-surface px-3 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-canvas">
                {initials(user.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{user.name}</span>
                <span className="block truncate text-[11.5px] text-muted">@{user.handle}</span>
              </span>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-28 md:pb-12 md:pt-8">{children}</main>
      </div>

      <BottomNav items={USER_NAV} />
    </div>
  );
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Honesty banner. When the chain provider is simulated, nothing settles on a
 * public network, and every screen says so rather than implying otherwise.
 */
function SimulationBanner() {
  return (
    <p className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-[12px] text-canvas/80">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-coral" aria-hidden />
      Demo environment. Balances and transfers are simulated; no funds move on a public blockchain.
    </p>
  );
}
