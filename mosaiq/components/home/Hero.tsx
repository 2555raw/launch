"use client";

import { motion, useReducedMotion, type PanInfo } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { defaultPad, getChain, pads } from "@/lib/pads";
import { site } from "@/lib/site";
import { LogoMark } from "@/components/ui/Logo";
import { ChainDot, PadGlyph } from "@/components/ui/PadGlyph";
import { useCopy } from "@/components/ui/useCopy";

const INTERVAL = 4500;

/** Four-point star used on the hero corners. */
export function Spark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`absolute size-3.5 text-fog ${className}`} fill="currentColor">
      <path d="M8 0C8.6 5 11 7.4 16 8 11 8.6 8.6 11 8 16 7.4 11 5 8.6 0 8 5 7.4 7.4 5 8 0Z" />
    </svg>
  );
}

/** Position of a card relative to the active one, wrapped to [-n/2, n/2]. */
function offsetOf(i: number, active: number, n: number) {
  let d = i - active;
  if (d > n / 2) d -= n;
  if (d < -n / 2) d += n;
  return d;
}

/** The Picker token's CA, copied on click. Hidden until the CA is set. */
function TokenCa({ ca }: { ca: string | null }) {
  const { copied, copy } = useCopy();
  if (!ca) return null;
  return (
    <button type="button" onClick={() => copy(ca, "ca")} aria-label={`Copy contract address ${ca}`} className="ca-shine group mx-auto mb-6 block w-full max-w-[460px] text-left">
      <span className="ca-inner flex items-center gap-3 py-2.5 pl-5 pr-2.5">
        <span className="metal shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.22em]">
          <span className="mr-2 inline-block size-1.5 -translate-y-px animate-pulse rounded-full bg-mint align-middle shadow-[0_0_10px_2px_rgb(61_217_179/0.7)]" />
          CA
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-bone">{ca}</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[linear-gradient(180deg,#ffffff,#d9d9d9)] px-3.5 py-1.5 text-xs font-semibold text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_4px_14px_-4px_rgb(255_255_255/0.5)] transition group-hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_6px_20px_-4px_rgb(255_255_255/0.7)]">
          {copied === "ca" ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied === "ca" ? "Copied" : "Copy"}
        </span>
      </span>
    </button>
  );
}

export function Hero({ counts, ca }: { counts: Record<string, number>; ca: string | null }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(() => Math.max(0, pads.findIndex((p) => p.id === defaultPad.id)));
  const [paused, setPaused] = useState(false);
  const pad = pads[index];
  const chain = getChain(pad.chain)!;

  const step = useCallback((d: number) => setIndex((i) => (i + d + pads.length) % pads.length), []);

  useEffect(() => {
    if (paused || reduce) return;
    const t = setTimeout(() => step(1), INTERVAL);
    return () => clearTimeout(t);
  }, [index, paused, reduce, step]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -60) step(1);
    else if (info.offset.x > 60) step(-1);
  }

  return (
    <section aria-labelledby="hero-title" className="card relative overflow-hidden px-6 py-12 sm:px-12 sm:py-16 lg:px-14">
      <Spark className="left-5 top-5" />
      <Spark className="right-5 top-5" />
      <Spark className="bottom-5 left-5" />
      <Spark className="bottom-5 right-5" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_24rem_at_75%_40%,rgb(255_255_255/0.05),transparent_70%)]" />

      <div className="relative grid grid-cols-1 items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <LogoMark className="size-12 sm:size-14" />
            <span className="metal display text-5xl font-semibold leading-none sm:text-6xl">{site.name}</span>
          </motion.p>
          <motion.h1
            id="hero-title"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="metal display mt-6 pb-1 text-[clamp(2.9rem,6vw,4.6rem)] font-bold leading-[0.95]"
          >
            Every pad.
            <br />
            Your pick.
          </motion.h1>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-8">
            <p className="tracked leading-loose">
              One form for every launchpad.
              <br />
              Your wallet or your agent signs.
            </p>
            <span className="mt-5 block h-px w-10 bg-line-strong" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.6 }}
            className="mt-6 max-w-md text-[16px] leading-relaxed text-fog"
          >
            {pads.filter((p) => !p.featured && p.chain !== "arc").map((p) => p.name).join(", ").replace(/, ([^,]*)$/, " and $1")} keep their own
            chains. Here you fill a single form and launch it from your own wallet, or let your agent do it. Home is{" "}
            <Link
              href={`/launch?chain=${defaultPad.chain}&pad=${defaultPad.id}`}
              className="inline-flex translate-y-[3px] items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 py-0.5 pl-1 pr-2.5 text-sm text-bone transition hover:border-white/30"
            >
              <PadGlyph pad={defaultPad.id} size="sm" className="!size-4 !rounded-full" /> {defaultPad.name}
            </Link>{" "}
            on {getChain(defaultPad.chain)!.name}.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.6 }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Link href="/launch" className="btn btn-primary btn-lg">
              Launch a token
            </Link>
            <Link href="/docs" className="btn btn-ghost btn-lg">
              Read the docs <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </motion.div>
        </div>

        <div>
          <TokenCa ca={ca} />
          <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Launchpads"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
          }}
        >
          <div className="relative mx-auto h-[320px] max-w-[460px] [perspective:1400px] sm:h-[360px]">
            {pads.map((p, i) => {
              const d = offsetOf(i, index, pads.length);
              const visible = Math.abs(d) <= 1;
              const c = getChain(p.chain)!;
              return (
                <motion.div
                  key={p.id}
                  className="absolute left-1/2 top-1/2 -ml-[100px] -mt-[130px] h-[260px] w-[200px] sm:-ml-[112px] sm:-mt-[145px] sm:h-[290px] sm:w-[224px]"
                  style={{ zIndex: 10 - Math.abs(d), pointerEvents: visible ? "auto" : "none" }}
                  initial={false}
                  animate={{
                    x: `${d * 62}%`,
                    y: d === 0 ? "-4%" : "3%",
                    rotateZ: d === 0 ? -4 : d * 5,
                    rotateY: d * -18,
                    scale: d === 0 ? 1 : 0.9,
                    opacity: visible ? 1 : 0,
                    filter: d === 0 ? "brightness(1)" : "brightness(0.55)",
                  }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 170, damping: 24 }}
                  drag={d === 0 ? "x" : false}
                  dragSnapToOrigin
                  dragElastic={0.2}
                  onDragEnd={onDragEnd}
                  aria-hidden={d !== 0}
                >
                  <button
                    type="button"
                    tabIndex={d === 0 ? 0 : -1}
                    onClick={() => d !== 0 && setIndex(i)}
                    aria-label={d === 0 ? `${p.name} on ${c.name}` : `Show ${p.name}`}
                    className="flex size-full cursor-grab flex-col rounded-[22px] border border-white/15 bg-[linear-gradient(160deg,#2c2c2c_0%,#171717_45%,#0c0c0c_100%)] p-4 text-left shadow-[0_30px_60px_-20px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.08)] active:cursor-grabbing"
                  >
                    <span className="flex items-start justify-between">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-bone">
                        <ChainDot chain={p.chain} className="size-3.5" /> {c.name}
                      </span>
                      <span className="font-mono text-[11px] text-fog">{String(i + 1).padStart(2, "0")}</span>
                    </span>
                    <span className="mx-auto mt-6 grid size-[104px] place-items-center rounded-full border-[3px] border-white/10 bg-[radial-gradient(circle_at_35%_30%,#2a2a2a,#0b0b0b)] shadow-[inset_0_2px_10px_rgb(0_0_0/0.8),0_0_0_1px_rgb(255_255_255/0.06)] sm:size-[116px]">
                      <PadGlyph pad={p.id} size="xl" className="!size-[72px] !rounded-full sm:!size-[84px]" />
                    </span>
                    <span className="mt-auto text-center">
                      <span className="block text-xl font-semibold tracking-tight">{p.name}</span>
                      <span className="mt-1 block text-lg font-semibold tracking-tight">
                        {p.featured ? "Home" : "Live"}{" "}
                        <span className="text-sm font-normal text-fog">{p.featured ? "pad" : `on ${site.name}`}</span>
                      </span>
                    </span>
                  </button>
                </motion.div>
              );
            })}
          </div>

          <div className="mx-auto mt-2 flex max-w-[460px] items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm" aria-live="polite">
                <span className="font-semibold text-bone">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-mute"> / {pads.length}</span>
              </span>
              <button type="button" onClick={() => step(-1)} aria-label="Previous launchpad" className="grid size-7 place-items-center rounded-full border border-line-strong text-fog transition hover:bg-surface-3 hover:text-bone">
                <ChevronLeft className="size-3.5" />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next launchpad" className="grid size-7 place-items-center rounded-full border border-line-strong text-fog transition hover:bg-surface-3 hover:text-bone">
                <ChevronRight className="size-3.5" />
              </button>
            </div>
            <Link href={`/launch?chain=${pad.chain}&pad=${pad.id}`} className="group inline-flex min-w-0 items-center gap-2 text-sm">
              <span className="truncate font-semibold">{pad.name}</span>
              <span className="hidden items-center gap-1 text-xs text-fog sm:inline-flex">
                <ChainDot chain={pad.chain} className="size-2" /> {chain.name}
              </span>
              <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              <span className="sr-only">({counts[pad.id] ?? 0} launches)</span>
            </Link>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
