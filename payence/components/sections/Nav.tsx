"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "../ui/Button";
import { SNAPSHOT } from "@/lib/snapshot";
import { XLink, X_URL } from "../ui/XLink";

const LINKS = [
  { label: "Product", href: "#product" },
  { label: "Platform", href: "#platform" },
  { label: "Developers", href: "#developers" },
  { label: "Security", href: "#security" },
];

/**
 * A floating pill rather than a full-width bar: it sits on the paper and rides
 * over the ink sections without cutting a band across them, so it needs no
 * inversion logic at all — it just gains a shadow once the page has moved.
 */
export function Nav() {
  const [open, setOpen] = useState(false);
  const [lifted, setLifted] = useState(false);
  const still = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 md:px-6 md:pt-5">
      <div
        className={`mx-auto flex h-16 w-full max-w-shell items-center justify-between gap-6 rounded-pill border border-hair bg-canvas pl-5 pr-2.5 transition-shadow duration-300 md:pl-7 ${
          lifted ? "shadow-[0_18px_44px_-30px_rgba(21,21,21,0.6)]" : ""
        }`}
      >
        <a href="#top" className="text-[18px] font-extrabold tracking-[-0.04em]">
          PAYENCE
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="nav-link text-[14px] text-muted transition-colors duration-200 hover:text-ink"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <XLink className="mr-1 flex h-9 w-9 items-center justify-center rounded-pill text-muted transition-colors duration-200 hover:bg-shell hover:text-ink" />
          <Button href="#get-started" size="md" className="hidden sm:inline-flex">
            Get Started
          </Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-11 w-11 items-center justify-center rounded-pill border border-hairStrong md:hidden"
          >
            <span className="relative block h-3 w-4">
              <span
                className={`burger-bar absolute left-0 block h-[1.5px] w-4 bg-ink transition-transform duration-200 ${
                  open ? "top-[5px] rotate-45" : "top-0"
                }`}
              />
              <span
                className={`burger-bar absolute left-0 top-[5px] block h-[1.5px] w-4 bg-ink transition-opacity duration-200 ${
                  open ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`burger-bar absolute left-0 block h-[1.5px] w-4 bg-ink transition-transform duration-200 ${
                  open ? "top-[5px] -rotate-45" : "top-[10px]"
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {SNAPSHOT ? (
        <div
          id="mobile-menu"
          hidden={!open}
          className="mx-auto mt-2 w-full max-w-shell overflow-hidden rounded-card border border-hair bg-canvas md:hidden"
        >
          <ul className="flex flex-col px-5 py-3">
            {LINKS.map((l) => (
              <li key={l.href} className="border-b border-hair last:border-0">
                <a href={l.href} className="block py-4 text-[17px] tracking-tight">
                  {l.label}
                </a>
              </li>
            ))}
            <li className="pb-2 pt-4">
              <Button href="#get-started" size="md" className="w-full">
                Get Started
              </Button>
            </li>
            <li className="pb-2">
              <a
                href={X_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block py-3 text-[14px] text-muted"
              >
                @usepayence on X
              </a>
            </li>
          </ul>
        </div>
      ) : (
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="mx-auto mt-2 w-full max-w-shell overflow-hidden rounded-card border border-hair bg-canvas md:hidden"
            initial={still ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={still ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 0.65, 0.3, 1] }}
          >
            <ul className="flex flex-col px-5 py-3">
              {LINKS.map((l) => (
                <li key={l.href} className="border-b border-hair last:border-0">
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block py-4 text-[17px] tracking-tight"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="pb-2 pt-4">
                <Button href="#get-started" size="md" className="w-full">
                  Get Started
                </Button>
              </li>
              <li className="pb-2">
                <a
                  href={X_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="block py-3 text-[14px] text-muted"
                >
                  @usepayence on X
                </a>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
      )}
    </header>
  );
}
