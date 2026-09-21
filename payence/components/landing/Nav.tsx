"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#merchants", label: "For business" },
  { href: "/#fees", label: "Fees" },
  { href: "/developers", label: "Developers" },
];

export function MarketingNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-[14px] text-muted transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
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
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="marketing-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-11 w-11 items-center justify-center rounded-pill border border-hair md:hidden"
          >
            <span className="relative block h-3 w-4" aria-hidden>
              <span className={`absolute left-0 block h-[1.5px] w-4 bg-ink transition-transform ${open ? "top-[5px] rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 top-[5px] block h-[1.5px] w-4 bg-ink transition-opacity ${open ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 block h-[1.5px] w-4 bg-ink transition-transform ${open ? "top-[5px] -rotate-45" : "top-[10px]"}`} />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <nav id="marketing-menu" aria-label="Main" className="border-t border-hair bg-canvas md:hidden">
          <ul className="shell py-2">
            {LINKS.map((l) => (
              <li key={l.href} className="border-b border-hair last:border-0">
                <Link href={l.href} onClick={() => setOpen(false)} className="block py-4 text-[16px]">
                  {l.label}
                </Link>
              </li>
            ))}
            {!signedIn && (
              <li className="py-4">
                <Button href="/login" variant="secondary" size="md" full>
                  Sign in
                </Button>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}
