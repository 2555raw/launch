"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icons";

export type NavItem = { href: string; label: string; icon: IconName; primary?: boolean };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1 px-1" aria-label="Main">
      {items.map((item) => {
        const I = Icon[item.icon];
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors ${
              active ? "bg-ink text-canvas" : "text-muted hover:bg-shell hover:text-ink"
            }`}
          >
            <I className="h-[18px] w-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The phone navigation. Five targets, each at least 56px tall, with the pay
 * action raised: one thumb, no reaching, no menu to open first.
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-hair bg-surface/95 backdrop-blur-md md:hidden"
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {items.map((item) => {
          const I = Icon[item.icon];
          const active = isActive(pathname, item.href);
          if (item.primary) {
            return (
              <li key={item.href} className="relative flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="mx-auto -mt-5 flex h-14 w-14 flex-col items-center justify-center rounded-full bg-coral text-white shadow-float"
                >
                  <I className="h-6 w-6" />
                  <span className="sr-only">{item.label}</span>
                </Link>
                <span className="mt-0.5 block pb-2 text-center text-[10.5px] font-medium text-muted">{item.label}</span>
              </li>
            );
          }
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-2 text-[10.5px] font-medium transition-colors ${
                  active ? "text-ink" : "text-muted"
                }`}
              >
                <I className="h-[21px] w-[21px]" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
