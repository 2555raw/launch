"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icons";

const SECTIONS = [
  { href: "/#how", label: "How it works", hint: "Add stablecoins, scan, done" },
  { href: "/#merchants", label: "For business", hint: "Take payments without a card network" },
  { href: "/#fees", label: "Fees", hint: "Every charge on one page" },
  { href: "/#security", label: "Security", hint: "How the money is kept safe" },
  { href: "/#faq", label: "Questions", hint: "The ones people actually ask" },
];

const ELSEWHERE = [
  { href: "/developers", label: "Developers", hint: "Take payments from your own site" },
  { href: "/developers/api", label: "API reference", hint: "Endpoints, errors, webhooks" },
  { href: "/legal/terms", label: "Terms", hint: "" },
  { href: "/legal/privacy", label: "Privacy", hint: "" },
];

/**
 * The bar carries the four links there is room for and a menu that holds
 * everything, at every width. A menu that only exists on a phone hides half the
 * site from anyone on a laptop, and the bar has no room to grow.
 */
export function MarketingNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [lifted, setLifted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Escape closes it, a click outside closes it, and focus goes back to the
  // button that opened it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-canvas/90 backdrop-blur-md transition-colors ${
        lifted ? "border-hair" : "border-transparent"
      }`}
    >
      <div className="shell flex h-16 items-center justify-between gap-6">
        <Link href="/" className="text-[19px] font-extrabold tracking-[-0.045em]">
          PAYENCE
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-8 md:flex">
          {SECTIONS.slice(0, 3).map((l) => (
            <Link key={l.href} href={l.href} className="text-[14px] text-muted transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
          <Link href="/developers" className="text-[14px] text-muted transition-colors hover:text-ink">
            Developers
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <Button href="/dashboard" size="md">
              Open app
            </Button>
          ) : (
            <>
              <Button href="/login" variant="ghost" size="md" className="hidden sm:inline-flex">
                Sign in
              </Button>
              <Button href="/signup" size="md">
                Get started
              </Button>
            </>
          )}

          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-11 w-11 items-center justify-center rounded-pill border border-hair transition-colors hover:border-hairStrong"
          >
            <span className="relative block h-3 w-[18px]" aria-hidden>
              <span
                className={`absolute left-0 block h-[1.5px] w-[18px] bg-ink transition-transform duration-200 ${
                  open ? "top-[5px] rotate-45" : "top-0"
                }`}
              />
              <span
                className={`absolute left-0 top-[5px] block h-[1.5px] w-[18px] bg-ink transition-opacity duration-200 ${
                  open ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 block h-[1.5px] w-[18px] bg-ink transition-transform duration-200 ${
                  open ? "top-[5px] -rotate-45" : "top-[11px]"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div ref={panelRef} id="site-menu" className="border-t border-hair bg-canvas">
          <div className="shell grid gap-8 py-8 md:grid-cols-[1.4fr_1fr]">
            <nav aria-label="Sections">
              <h2 className="text-[11px] uppercase tracking-[0.1em] text-muted">On this page</h2>
              <ul className="mt-4 grid gap-1 sm:grid-cols-2">
                {SECTIONS.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-shell"
                    >
                      <span className="block text-[15px] font-medium">{l.label}</span>
                      {l.hint && <span className="mt-0.5 block text-[12.5px] text-muted">{l.hint}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <nav aria-label="Elsewhere">
                <h2 className="text-[11px] uppercase tracking-[0.1em] text-muted">Elsewhere</h2>
                <ul className="mt-4 space-y-1">
                  {ELSEWHERE.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-xl px-3 py-2 text-[14.5px] transition-colors hover:bg-shell"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="mt-6 flex flex-wrap gap-2 sm:hidden">
                <Button href="/login" variant="secondary" size="md">
                  Sign in
                </Button>
                <Button href="/signup" size="md">
                  Get started
                </Button>
              </div>

              <Link
                href="/merchant"
                onClick={() => setOpen(false)}
                className="mt-6 flex items-center gap-3 rounded-card border border-hair bg-surface px-4 py-3.5 transition-colors hover:border-hairStrong"
              >
                <Icon.store className="h-[18px] w-[18px] text-coral" />
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium">Accept payments</span>
                  <span className="block text-[12.5px] text-muted">Set up a merchant account</span>
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
