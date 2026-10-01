"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/#home", label: "Home" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#rewards", label: "Rewards" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#leaderboard", label: "Payouts" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "mx-auto mt-3 flex max-w-[1240px] items-center justify-between gap-4 rounded-2xl px-3 py-2.5 transition-all duration-500 sm:px-4",
          "mx-3 sm:mx-6 xl:mx-auto",
          scrolled || open ? "glass-strong" : "border border-transparent",
        )}
      >
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map((l) => {
            const active = l.href === "/dashboard" ? pathname.startsWith("/dashboard") : false;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative rounded-xl px-3.5 py-2 text-[13.5px] font-medium text-white/70 transition hover:bg-white/5 hover:text-white",
                  active && "text-white",
                )}
              >
                {l.label}
                {active && <span className="absolute inset-x-3.5 -bottom-px h-px bg-lime-400" />}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <ConnectWallet size="sm" />
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 lg:hidden"
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
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-strong mx-3 mt-2 rounded-2xl p-2 sm:mx-6 lg:hidden"
            aria-label="Mobile"
          >
            {LINKS.map((l, i) => (
              <motion.div key={l.href} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-[15px] font-medium text-white/80 hover:bg-white/5"
                >
                  {l.label}
                  <span className="font-mono text-[10px] text-white/30">0{i + 1}</span>
                </Link>
              </motion.div>
            ))}
            <div className="p-2 sm:hidden">
              <ConnectWallet className="w-full" />
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
