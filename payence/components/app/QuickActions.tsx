import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icons";

const ACTIONS: { href: string; label: string; icon: IconName }[] = [
  { href: "/pay", label: "Pay", icon: "scan" },
  { href: "/send", label: "Send", icon: "send" },
  { href: "/receive", label: "Receive", icon: "receive" },
  { href: "/wallet/deposit", label: "Add money", icon: "plus" },
];

/** Four taps, evenly spaced, each a 64px target: the whole product in one row. */
export function QuickActions() {
  return (
    <nav aria-label="Quick actions">
      <ul className="grid grid-cols-4 gap-2.5">
        {ACTIONS.map((a) => {
          const I = Icon[a.icon];
          return (
            <li key={a.href}>
              <Link
                href={a.href}
                className="flex flex-col items-center gap-2 rounded-card border border-hair bg-surface px-2 py-4 text-[12.5px] font-medium shadow-card transition-colors hover:border-hairStrong"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-shell text-ink">
                  <I className="h-[19px] w-[19px]" />
                </span>
                {a.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
