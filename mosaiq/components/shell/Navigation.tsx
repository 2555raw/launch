"use client";

import { Bot, ChartColumn, Compass, FileText, House, Rocket, Search, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { nav, site } from "@/lib/site";
import { Logo } from "@/components/ui/Logo";
import { XIcon } from "@/components/ui/XIcon";
import { useApp } from "./AppProvider";

const icons = { "/": House, "/explore": Compass, "/launch": Rocket, "/analytics": ChartColumn, "/docs": FileText } as const;

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

/** Desktop icon rail. */
export function Sidebar() {
  const isActive = useActive();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col items-center border-r border-line bg-ink py-4 lg:flex">
      <Link href="/" aria-label={`${site.name} home`} className="flex h-8 items-center px-1 text-[14px] font-bold tracking-tight">
        {site.name}
      </Link>
      <nav aria-label="Sections" className="mt-5 mb-auto flex flex-col gap-2">
        {nav.map((item) => {
          const Icon = icons[item.href];
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative grid size-11 place-items-center rounded-xl transition-colors",
                active ? "bg-surface-3 text-bone" : "text-mute hover:bg-surface-2 hover:text-bone",
              )}
            >
                            <Icon className="size-[18px]" aria-hidden="true" />
              <span className="pointer-events-none absolute left-full ml-3 rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1 text-xs whitespace-nowrap text-bone opacity-0 shadow-xl transition group-hover:opacity-100 group-focus-visible:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
      {site.social.x && (
      <a
        href={site.social.x.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${site.name} on X`}
        className="mt-auto grid size-11 place-items-center rounded-xl text-mute transition hover:bg-surface-2 hover:text-bone"
      >
        <XIcon />
      </a>
      )}
    </aside>
  );
}

export function Topbar() {
  const { openPalette, openConnect, agent } = useApp();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label={`${site.name} home`} className="lg:hidden">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={openPalette}
          className="group ml-auto flex h-10 items-center gap-3 rounded-full border border-line-strong bg-surface/60 px-3 text-sm text-mute transition hover:border-white/20 hover:text-fog sm:px-4 lg:mx-auto lg:w-full lg:max-w-xl"
          aria-label="Search tokens, creators and pages"
        >
          <Search className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Search tokens or creators</span>
          <kbd className="ml-auto hidden rounded-md border border-line-strong px-1.5 py-0.5 font-mono text-[10px] sm:inline">⌘K</kbd>
        </button>
        <div className="flex items-center gap-2 lg:ml-0">
          <Link href="/launch" className="btn btn-primary btn-sm hidden h-9 px-4 sm:inline-flex">
            Launch
          </Link>
          <button type="button" onClick={openConnect} className="btn btn-ghost h-9 px-3 sm:px-4" aria-label={agent ? `Agent ${agent.name}` : "Connect your agent"}>
            {agent ? (
              <>
                <span className="relative grid size-5 place-items-center">
                  <Bot className="size-4" aria-hidden="true" />
                  <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse-dot rounded-full bg-mint ring-2 ring-ink" />
                </span>
                <span className="hidden max-w-[10rem] truncate sm:inline">{agent.name}</span>
              </>
            ) : (
              <>
                <Wallet className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Connect your agent</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

/** Bottom tab bar on phones and tablets. */
export function MobileNav() {
  const isActive = useActive();
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {nav.map((item) => {
          const Icon = icons[item.href];
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
                  active ? "text-bone" : "text-mute hover:text-fog",
                )}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-surface-3")}>
                  <Icon className={cn("size-[18px]", item.href === "/launch" && active && "text-accent")} aria-hidden="true" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
