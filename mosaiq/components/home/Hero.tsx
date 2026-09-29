"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { getChain, pads } from "@/lib/pads";
import { site } from "@/lib/site";
import { ChainDot, PadGlyph } from "@/components/ui/PadGlyph";

const INTERVAL = 5000;

export function Hero({ counts }: { counts: Record<string, number> }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const pad = pads[index];
  const chain = getChain(pad.chain)!;

  const step = useCallback((d: number) => setIndex((i) => (i + d + pads.length) % pads.length), []);

  useEffect(() => {
    if (!playing || hovered || reduce) return;
    const t = setTimeout(() => step(1), INTERVAL);
    return () => clearTimeout(t);
  }, [index, playing, hovered, reduce, step]);

  return (
    <section aria-labelledby="hero-title" className="card relative overflow-hidden px-5 py-10 sm:px-10 sm:py-14 lg:px-14">
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-ember/10 blur-3xl" />
      <div className="relative grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-ink/40 px-3 py-1 text-[13px] text-fog"
          >
            <span className="size-1.5 animate-pulse-dot rounded-full bg-ember" />
            {pads.length} launchpads · 3 chains · 1 studio
          </motion.p>
          <motion.h1
            id="hero-title"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="display mt-6 text-[clamp(2.75rem,7vw,5.25rem)] font-semibold leading-[0.95]"
          >
            Every launchpad.
            <br />
            <span className="bg-gradient-to-r from-bone via-fog to-mute bg-clip-text text-transparent">One canvas.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-lg text-[17px] leading-relaxed text-fog"
          >
            {site.name} puts Pump.fun, Four.meme, Clanker and more behind a single launch form. Each token still lives on its own
            pad and chain. You shape the draft; your agent signs and places the launch.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Link href="/launch" className="btn btn-ember btn-lg">
              Launch a token <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/docs" className="btn btn-ghost btn-lg">
              How it works
            </Link>
          </motion.div>
        </div>

        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          role="region"
          aria-roledescription="carousel"
          aria-label="Launchpads"
        >
          {/* Spotlight */}
          <div className="relative overflow-hidden rounded-3xl border border-line-strong bg-ink-2 p-6 sm:p-7">
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-60 transition-[background] duration-700"
              style={{ background: `radial-gradient(28rem 16rem at 100% 0%, color-mix(in srgb, ${pad.color} 22%, transparent), transparent 70%)` }}
            />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pad.id}
                initial={reduce ? false : { opacity: 0, y: 14, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? undefined : { opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
                aria-live={playing && !hovered ? "off" : "polite"}
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-fog">
                    <ChainDot chain={pad.chain} /> {chain.name}
                  </span>
                  <span className="font-mono text-[11px] text-mute">
                    {String(index + 1).padStart(2, "0")} / {String(pads.length).padStart(2, "0")}
                  </span>
                </div>
                <div className="mt-8 flex items-end gap-5">
                  <PadGlyph pad={pad.id} size="xl" />
                  <div className="min-w-0">
                    <p className="display truncate text-4xl font-semibold sm:text-5xl">{pad.name}</p>
                    <p className="mt-1 text-sm text-fog">
                      {counts[pad.id] ?? 0} {counts[pad.id] === 1 ? "launch" : "launches"} via {site.name}
                    </p>
                  </div>
                </div>
                <p className="mt-6 min-h-[3rem] text-[15px] leading-relaxed text-fog">{pad.blurb}</p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {pad.pairs.map((p) => (
                      <span key={p.symbol} className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-[11px] text-fog">
                        {p.symbol}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={`/launch?chain=${pad.chain}&pad=${pad.id}`}
                    className="group inline-flex items-center gap-1.5 text-sm font-medium text-bone"
                  >
                    Launch on {pad.name}
                    <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
            {playing && !hovered && !reduce && (
              <motion.span
                key={`bar-${index}`}
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-ember/70"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: INTERVAL / 1000, ease: "linear" }}
              />
            )}
          </div>

          {/* Mosaic of tiles */}
          <div className="mt-3 grid grid-cols-3 gap-3" role="group" aria-label="Choose a launchpad">
            {pads.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-pressed={i === index}
                aria-label={`Show ${p.name}`}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-2xl border border-line bg-surface/60 p-2.5 text-left transition-colors hover:border-line-strong sm:p-3",
                  i === index && "border-transparent",
                )}
              >
                {i === index && (
                  <motion.span
                    layoutId="hero-active-tile"
                    className="absolute inset-0 rounded-2xl border border-ember/60 bg-ember/[0.06]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <PadGlyph pad={p.id} size="sm" className="relative" />
                <span className="relative min-w-0">
                  <span className="block truncate text-[13px] font-medium">{p.name}</span>
                  <span className="hidden truncate text-[11px] text-mute sm:block">{getChain(p.chain)!.name}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => step(-1)} aria-label="Previous launchpad" className="grid size-9 place-items-center rounded-full border border-line-strong text-fog transition hover:bg-surface-2 hover:text-bone">
                <ChevronLeft className="size-4" />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next launchpad" className="grid size-9 place-items-center rounded-full border border-line-strong text-fog transition hover:bg-surface-2 hover:text-bone">
                <ChevronRight className="size-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause rotation" : "Resume rotation"}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-mute transition hover:text-bone"
            >
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {playing ? "Auto" : "Paused"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
