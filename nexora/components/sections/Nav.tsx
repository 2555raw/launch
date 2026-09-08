"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "../ui/Button";

const LINKS = [
  { label: "Product", href: "#product" },
  { label: "Platform", href: "#platform" },
  { label: "Developers", href: "#developers" },
  { label: "Security", href: "#security" },
];

const NAV_H = 76;

export function Nav() {
  const [open, setOpen] = useState(false);
  const [lifted, setLifted] = useState(false);
  const [dark, setDark] = useState(false);
  const still = useReducedMotion();

  // The bar reads the section behind it. Over the ink sections it inverts, so a
  // cream band never cuts across them; on paper it stays flat until the page moves.
  useEffect(() => {
    let raf = 0;

    const measure = () => {
      raf = 0;
      const mid = NAV_H / 2;
      const overInk = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-ink]")).some(
        (el) => {
          const r = el.getBoundingClientRect();
          return r.top <= mid && r.bottom >= mid;
        }
      );
      setDark(overInk);
      setLifted(window.scrollY > 12);
    };

    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const surface = dark
    ? `text-canvas ${lifted ? "border-b border-hairDark bg-ink/90 backdrop-blur-md" : "border-b border-transparent"}`
    : `text-ink ${lifted ? "border-b border-hair bg-canvas/85 backdrop-blur-md" : "border-b border-transparent"}`;

  return (
    <header className={`sticky top-0 z-50 transition-colors duration-500 ${surface}`}>
      <nav className="shell flex h-[76px] items-center justify-between gap-8" aria-label="Main">
        <a href="#top" className="text-[19px] font-extrabold tracking-[-0.04em]">
          NEXORA
        </a>

        <ul className="hidden items-center gap-9 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className={`text-[14px] transition-colors duration-300 ${
                  dark ? "text-canvas/60 hover:text-canvas" : "text-muted hover:text-ink"
                }`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <Button
            href="#get-started"
            size="sm"
            variant={dark ? "invert" : "solid"}
            className="hidden sm:inline-flex"
          >
            Get Started
          </Button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className={`flex h-9 w-9 items-center justify-center rounded-pill border transition-colors duration-300 md:hidden ${
              dark ? "border-canvas/25" : "border-hairStrong"
            }`}
          >
            <span className="relative block h-3 w-4">
              {[
                open ? "top-[5px] rotate-45" : "top-0",
                open ? "opacity-0" : "opacity-100",
                open ? "top-[5px] -rotate-45" : "top-[10px]",
              ].map((state, i) => (
                <span
                  key={i}
                  className={`absolute left-0 block h-[1.5px] w-4 transition-all duration-200 ${
                    dark ? "bg-canvas" : "bg-ink"
                  } ${i === 1 ? `top-[5px] ${state}` : state}`}
                />
              ))}
            </span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className={`overflow-hidden border-t md:hidden ${
              dark ? "border-hairDark bg-ink" : "border-hair bg-canvas"
            }`}
            initial={still ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={still ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 0.65, 0.3, 1] }}
          >
            <ul className="shell flex flex-col py-4">
              {LINKS.map((l) => (
                <li
                  key={l.href}
                  className={`border-b last:border-0 ${dark ? "border-hairDark" : "border-hair"}`}
                >
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block py-4 text-[17px] tracking-tight"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="pt-5">
                <Button
                  href="#get-started"
                  size="md"
                  variant={dark ? "invert" : "solid"}
                  className="w-full"
                >
                  Get Started
                </Button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
