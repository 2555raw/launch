import Link from "next/link";
import type { ReactNode } from "react";
import { NavLinks, BottomNav } from "./Nav";
import { Icon } from "@/components/ui/Icons";
import { SIMULATED_CHAIN } from "@/lib/config";
import { Badge } from "@/components/ui/Status";

export const MERCHANT_NAV = [
  { href: "/merchant/dashboard", label: "Overview", icon: "chart" as const },
  { href: "/merchant/payments", label: "Charge", icon: "plus" as const, primary: true },
  { href: "/merchant/transactions", label: "Payments", icon: "list" as const },
  { href: "/merchant/developers", label: "Developers", icon: "code" as const },
  { href: "/merchant/settings", label: "Settings", icon: "settings" as const },
];

export function MerchantShell({
  children,
  merchant,
}: {
  children: ReactNode;
  merchant: { name: string; status: string };
}) {
  return (
    <div className="min-h-dvh bg-canvas">
      {SIMULATED_CHAIN && (
        <p className="bg-ink px-4 py-2 text-center text-[12px] text-canvas/80">
          Demo environment. Settlement is simulated; no funds move on a public blockchain.
        </p>
      )}
      <div className="mx-auto flex w-full max-w-app gap-8 px-0 md:px-8">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col py-8 md:flex">
          <Link href="/merchant/dashboard" className="mb-2 px-3 text-[19px] font-extrabold tracking-[-0.04em]">
            PAYENCE
          </Link>
          <p className="mb-8 px-3 text-[12px] uppercase tracking-[0.1em] text-muted">Merchant</p>
          <NavLinks items={MERCHANT_NAV} />
          <div className="mt-auto space-y-3 px-1">
            <div className="rounded-xl border border-hair bg-surface px-3 py-3">
              <p className="truncate text-[13px] font-medium">{merchant.name}</p>
              <p className="mt-1.5">
                <Badge tone={merchant.status === "verified" ? "positive" : "warning"}>
                  {merchant.status === "verified" ? "Verified" : "Verification pending"}
                </Badge>
              </p>
            </div>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-muted transition-colors hover:bg-shell hover:text-ink"
            >
              <Icon.wallet className="h-[18px] w-[18px]" />
              Personal account
            </Link>
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-28 md:pb-12 md:pt-8">{children}</main>
      </div>
      <BottomNav items={MERCHANT_NAV} />
    </div>
  );
}
