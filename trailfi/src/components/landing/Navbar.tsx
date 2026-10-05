"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Footprints, LayoutDashboard, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { XLogo } from "@/components/ui/XLogo";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { cn } from "@/lib/cn";
import { X_URL } from "@/lib/social";

const SECTIONS = [
  { id: "how-it-works", label: "How it works" },
  { id: "rewards", label: "Rewards" },
  { id: "ranking", label: "Ranking" },
  { id: "leaderboard", label: "Payouts" },
  { id: "faq", label: "FAQ" },
];

/** Which landing section is under the header, so its link can light up. */
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return setActive(null);
    const onScroll = () => {
      const line = window.innerHeight * 0.35;
      let current: string | null = null;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      // Past the FAQ (call to action, footer) nothing is highlighted.
      const faq = document.getElementById("faq");
      if (faq && faq.getBoundingClientRect().bottom < line) current = null;
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);
  return active;
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const active = useActiveSection(pathname === "/");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const onSteps = pathname.startsWith("/steps");

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6">
      {/* At the top it spans the page; once you scroll it tightens into one floating capsule. */}
      <div
        className={cn(
          "mx-auto flex items-center justify-between gap-4 rounded-full border py-2 pl-4 pr-2 transition-[max-width,background-color,border-color,box-shadow] duration-500 ease-out",
          scrolled || open
            ? "max-w-[1040px] border-white/[0.08] bg-ink-950/70 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl backdrop-saturate-150"
            : "max-w-[1240px] border-transparent",
        )}
      >
        <Logo />

        <nav className="hidden items-center lg:flex" aria-label="Main">
          {SECTIONS.map((s) => {
            const on = active === s.id;
            return (
              <Link
                key={s.id}
                href={`/#${s.id}`}
                className={cn(
                  "relative rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors",
                  on ? "text-white" : "text-white/55 hover:text-white",
                )}
              >
                {on && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-full bg-white/[0.07]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{s.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <a
            href={X_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Stepit on X"
            className="hidden h-9 w-9 place-items-center rounded-full border border-white/10 text-white/80 transition hover:border-lime-400/40 hover:bg-white/[0.06] hover:text-lime-300 sm:grid"
          >
            <XLogo className="h-[15px] w-[15px]" />
          </a>
          <Link
            href="/steps"
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-3.5 py-2 text-[13.5px] font-medium transition md:inline-flex",
              onSteps ? "text-lime-300" : "text-white/75 hover:text-white",
            )}
          >
            <Footprints className="h-4 w-4 text-lime-400" /> Upload steps
          </Link>
          <div className="hidden sm:block">
            <ConnectWallet size="sm" className="!rounded-full" />
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="mx-auto mt-2 max-w-[1040px] origin-top rounded-3xl border border-white/[0.08] bg-ink-950/90 p-2 backdrop-blur-xl lg:hidden"
            aria-label="Mobile"
          >
            {SECTIONS.map((s) => (
              <Link
                key={s.id}
                href={`/#${s.id}`}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-medium hover:bg-white/[0.05]",
                  active === s.id ? "text-white" : "text-white/70",
                )}
              >
                {s.label}
                {active === s.id && <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />}
              </Link>
            ))}
            <div className="my-2 h-px bg-white/[0.06]" />
            <div className="grid grid-cols-2 gap-2 px-1">
              <Link href="/steps" className="flex items-center gap-2 rounded-2xl bg-white/[0.04] px-4 py-3 text-[14px] font-medium text-white/85">
                <Footprints className="h-4 w-4 text-lime-400" /> Upload steps
              </Link>
              <Link href="/dashboard" className="flex items-center gap-2 rounded-2xl bg-white/[0.04] px-4 py-3 text-[14px] font-medium text-white/85">
                <LayoutDashboard className="h-4 w-4 text-lime-400" /> Dashboard
              </Link>
            </div>
            <a
              href={X_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex items-center justify-between rounded-2xl px-4 py-3 text-[14px] text-white/60 hover:bg-white/[0.05]"
            >
              <span className="flex items-center gap-2">
                <XLogo className="h-3.5 w-3.5" /> Follow @HelloStepit
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <div className="p-1 pt-2 sm:hidden">
              <ConnectWallet className="w-full" />
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
