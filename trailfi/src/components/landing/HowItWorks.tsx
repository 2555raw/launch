"use client";

import { AnimatePresence, animate, motion, useInView, useMotionTemplate, useMotionValue, useReducedMotion } from "framer-motion";
import { Check, Coins, MousePointerClick, Plus, RotateCcw, Send, ShieldCheck, Wallet } from "lucide-react";
import { MarkIcon } from "@/components/Logo";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { Reveal, SectionHeading } from "./Reveal";

const STEPS = [
  {
    n: "01",
    stage: "Trailhead",
    title: "Connect your wallet",
    body: "Pick your wallet and sign one free message to prove it is yours.",
    icon: Wallet,
    tags: ["~30 seconds", "No gas"],
    Visual: WalletVisual,
  },
  {
    n: "02",
    stage: "Ascent",
    title: "Track your steps",
    body: "Upload your daily steps with a screenshot. Only verified activity counts.",
    icon: MarkIcon,
    tags: ["Daily goal", "Verified"],
    Visual: StepsVisual,
  },
  {
    n: "03",
    stage: "Summit",
    title: "Earn rewards",
    body: "Each verified day pays in ETH. Request a payout and it lands in your wallet after review.",
    icon: Coins,
    tags: ["ETH", "Onchain"],
    Visual: PayoutVisual,
  },
];

export function HowItWorks() {
  const rail = useRef<HTMLDivElement>(null);
  const railIn = useInView(rail, { once: true, margin: "-120px" });

  return (
    <section id="how-it-works" className="relative scroll-mt-24 overflow-hidden py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-forest-600/20 blur-[120px]" />

      <div className="container relative">
        <SectionHeading index="01" label="How it works" title="From trailhead to payout" accent="in three steps.">
          No lockups, no staking, nothing to buy. Walk, upload your steps, and collect your share.
        </SectionHeading>

        {/* Progress rail: fills from the first stage to the last as it scrolls into view. */}
        <div ref={rail} className="relative mt-16 hidden h-10 md:block" aria-hidden>
          <div className="absolute left-[16.66%] right-[16.66%] top-1/2 h-px -translate-y-1/2 bg-white/10" />
          <motion.div
            className="absolute left-[16.66%] right-[16.66%] top-1/2 h-px origin-left -translate-y-1/2 bg-gradient-to-r from-lime-400 via-lime-300 to-neon shadow-[0_0_12px_rgba(77,148,255,0.7)]"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: railIn ? 1 : 0 }}
            transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1] }}
          />
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              className="absolute top-1/2 flex items-center gap-2 rounded-full border border-lime-400/30 bg-ink-950 py-1 pl-1 pr-3"
              style={{ left: `${16.66 + i * 33.33}%`, x: "-50%", y: "-50%" }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={railIn ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.15 + i * 0.6, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-lime-400 font-mono text-[10px] font-bold text-ink-950">{s.n}</span>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-lime-300">{s.stage}</span>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12} className="h-full">
              <StepCard step={s} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCard({ step: s }: { step: (typeof STEPS)[number] }) {
  // Soft lime spotlight that follows the cursor; the card itself stays still.
  const mx = useMotionValue(-400);
  const my = useMotionValue(-400);
  const spotlight = useMotionTemplate`radial-gradient(340px circle at ${mx}px ${my}px, rgba(77,148,255,0.10), transparent 70%)`;

  return (
    <motion.div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      onMouseLeave={() => {
        mx.set(-400);
        my.set(-400);
      }}
      className="group relative h-full rounded-3xl bg-gradient-to-b from-white/[0.14] via-white/[0.05] to-white/[0.02] p-px transition-colors duration-500 hover:from-lime-400/50 hover:via-lime-400/10"
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[23px] bg-ink-900/95 p-6 sm:p-7">
        <motion.div className="pointer-events-none absolute inset-0" style={{ background: spotlight }} />

        <s.Visual />

        <div className="relative mt-7 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-lime-400/25 bg-forest-800/80 text-lime-300 shadow-[0_0_24px_-6px_rgba(47,123,255,0.6)] transition duration-500 ">
            <s.icon className="h-[18px] w-[18px]" />
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-lime-400">
            {s.n} · {s.stage}
          </span>
        </div>
        <h3 className="relative mt-4 font-display text-2xl font-semibold tracking-tight">{s.title}</h3>
        <p className="relative mt-2.5 text-[15px] leading-relaxed text-white/60">{s.body}</p>
        <div className="relative mt-auto flex flex-wrap gap-2 pt-6">
          {s.tags.map((t) => (
            <span key={t} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[10.5px] uppercase tracking-widest text-white/55">
              {t}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/** Inset "screen" that holds each card's mini product preview. */
function Screen({ children, hint, className }: { children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={cn("relative h-[196px] overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-950/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", className)}>
      <div className="pointer-events-none absolute inset-0 bg-grid-fade bg-[size:22px_22px] opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      {hint && (
        <span className="pointer-events-none absolute right-3 top-2.5 flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-lime-400/70">
          <MousePointerClick className="h-3 w-3" /> {hint}
        </span>
      )}
      <div className="relative h-full">{children}</div>
    </div>
  );
}

/**
 * Advances 0 → max one stage at a time. Runs once when the element scrolls
 * into view (if `auto`), and again every time `run` is called.
 */
function useSequence(max: number, every: number, auto = true) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const run = useCallback(() => {
    timers.current.forEach(clearTimeout);
    if (reduce) {
      setStage(max);
      return;
    }
    setStage(0);
    timers.current = Array.from({ length: max }, (_, i) => setTimeout(() => setStage(i + 1), 350 + i * every));
  }, [max, every, reduce]);

  useEffect(() => {
    if (inView && auto) run();
  }, [inView, auto, run]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return { ref, stage, run };
}

const WALLETS = [
  { name: "Phantom", logo: "/wallets/phantom.svg", glow: "#ab9ff2", address: "0x7a3f…c21e" },
  { name: "MetaMask", logo: "/wallets/metamask.svg", glow: "#f6851b", address: "0x4b91…08fa" },
  { name: "Coinbase", logo: "/wallets/coinbase.svg", glow: "#0052ff", address: "0xc02e…77b3" },
  { name: "Rabby", logo: "/wallets/rabby.svg", glow: "#7084ff", address: "0x19d4…e6a0" },
];

function WalletVisual() {
  const [picked, setPicked] = useState(0);
  const { ref, stage, run } = useSequence(3, 650);
  const w = WALLETS[picked];
  return (
    <Screen hint="Pick a wallet">
      <div ref={ref} className="flex h-full flex-col pt-4">
        <div className="grid grid-cols-4 gap-2">
          {WALLETS.map((x, i) => {
            const active = i === picked && stage >= 1;
            return (
              <motion.button
                key={x.name}
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => {
                  setPicked(i);
                  run();
                }}
                aria-label={`Connect with ${x.name}`}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2 transition-colors duration-300",
                  active ? "border-lime-400/60 bg-lime-400/[0.09]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/20",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.logo} alt="" className="h-7 w-7 rounded-lg" style={{ boxShadow: `0 0 14px -4px ${x.glow}` }} />
                <span className="text-[9.5px] text-white/60">{x.name}</span>
                {i === picked && stage === 1 && (
                  <motion.span
                    className="absolute inset-0 rounded-xl border border-lime-400"
                    initial={{ opacity: 0.9, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.18 }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
        <div className="mt-auto space-y-2">
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border px-3 py-2 text-[12px] transition duration-500",
              stage >= 2 ? "border-lime-400/30 bg-lime-400/[0.06]" : "border-white/[0.06] bg-white/[0.02]",
            )}
          >
            <span className="flex items-center gap-2">
              <span className={cn("h-1.5 w-1.5 rounded-full transition", stage >= 2 ? "bg-neon shadow-neon" : "animate-pulse-dot bg-white/40")} />
              <span className="font-mono text-white/80">{stage >= 2 ? w.address : `Opening ${w.name}…`}</span>
            </span>
            <span className={cn("font-mono text-[10px] uppercase tracking-widest transition", stage >= 2 ? "text-lime-300" : "text-white/30")}>
              {stage >= 2 ? "Connected" : "Waiting"}
            </span>
          </div>
          <div className={cn("flex items-center gap-2 text-[11px] transition duration-500", stage >= 3 ? "text-white/60 opacity-100" : "opacity-0")}>
            <ShieldCheck className="h-3.5 w-3.5 text-lime-400" />
            Message signed · no transaction · no approvals
          </div>
        </div>
      </div>
    </Screen>
  );
}

const WEEK = [4210, 6630, 5480, 9050, 7240, 10360];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const GOAL = 10_000;
const BAR_MAX = 14_000;

function StepsVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const [today, setToday] = useState(0);
  const [shown, setShown] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [bursts, setBursts] = useState<number[]>([]);

  useEffect(() => {
    if (inView) setToday(6820);
  }, [inView]);

  // Count the number up to the current total.
  useEffect(() => {
    if (reduce) {
      setShown(today);
      return;
    }
    const controls = animate(shown, today, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, reduce]);

  const walk = () => {
    setToday((t) => (t >= BAR_MAX - 1500 ? 2140 : t + 900 + Math.round(Math.random() * 700)));
    setBursts((b) => [...b.slice(-4), Date.now()]);
  };
  const goal = today >= GOAL;
  const values = [...WEEK, today];

  return (
    <Screen hint="Tap walk">
      <div ref={ref} className="flex h-full flex-col pt-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">Today</div>
            <div className="mt-0.5 font-display text-[26px] font-bold leading-none tabular-nums">{shown.toLocaleString("en-US")}</div>
          </div>
          <motion.button
            type="button"
            onClick={walk}
            whileTap={{ scale: 0.92 }}
            className={cn(
              "relative mt-3 flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest transition-colors",
              goal ? "border-lime-400 bg-lime-400 text-ink-950" : "border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/20",
            )}
          >
            {goal ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            {goal ? "Goal hit" : "Walk"}
            <AnimatePresence>
              {bursts.map((id) => (
                <motion.span
                  key={id}
                  className="pointer-events-none absolute -top-1 right-2 text-lime-300"
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -22 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9 }}
                  onAnimationComplete={() => setBursts((b) => b.filter((x) => x !== id))}
                >
                  <MarkIcon className="h-3.5 w-3.5" />
                </motion.span>
              ))}
            </AnimatePresence>
          </motion.button>
        </div>
        <div className="relative mt-auto flex h-[84px] items-end gap-2">
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-lime-400/30"
            style={{ bottom: `${(GOAL / BAR_MAX) * 100}%` }}
          >
            <span className="absolute -top-2.5 left-0 bg-ink-950 pr-1 font-mono text-[9px] uppercase tracking-widest text-lime-400/70">Goal</span>
          </div>
          {values.map((v, i) => {
            const isToday = i === values.length - 1;
            return (
              <div
                key={i}
                className="relative flex h-full flex-1 items-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {hover === i && (
                  <span className="absolute -top-5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-lime-400 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-ink-950">
                    {v.toLocaleString("en-US")}
                  </span>
                )}
                <motion.div
                  className={cn(
                    "w-full rounded-t-md",
                    isToday ? "bg-gradient-to-t from-lime-500 to-lime-300" : v >= GOAL ? "bg-lime-400/40" : "bg-white/[0.14]",
                    hover === i && !isToday && "bg-white/30",
                  )}
                  initial={{ height: 0 }}
                  animate={{ height: inView ? `${Math.max(4, (v / BAR_MAX) * 100)}%` : 0 }}
                  transition={{ delay: isToday ? 0 : 0.2 + i * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-2 font-mono text-[9px] text-white/30">
          {DAYS.map((d, i) => (
            <span key={i} className={cn("flex-1 text-center", i === 6 && "text-lime-300")}>
              {d}
            </span>
          ))}
        </div>
      </div>
    </Screen>
  );
}

const PAYOUT_FLOW = ["Payout requested", "Reviewed by the team", "Sent to your wallet"];

function PayoutVisual() {
  const { ref, stage, run } = useSequence(3, 750, false);
  const started = stage > 0;
  const done = stage >= 3;
  return (
    <Screen hint={started ? undefined : "Try it"}>
      <div ref={ref} className="flex h-full flex-col pt-4">
        <ol className="space-y-2.5">
          {PAYOUT_FLOW.map((label, i) => {
            const ok = stage > i;
            const busy = started && stage === i;
            return (
              <li key={label} className="flex items-center gap-3">
                <span
                  className={cn(
                    "relative grid h-6 w-6 shrink-0 place-items-center rounded-full border transition duration-500",
                    ok ? "border-lime-400 bg-lime-400 text-ink-950 shadow-[0_0_14px_rgba(77,148,255,0.55)]" : "border-white/15 text-transparent",
                  )}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  {busy && <span className="absolute inset-0 animate-spin rounded-full border-2 border-lime-400/70 border-t-transparent" />}
                </span>
                <span className={cn("text-[12.5px] transition duration-500", ok ? "text-white/85" : busy ? "text-white/70" : "text-white/35")}>{label}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-auto">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="paid"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between rounded-xl border border-lime-400/25 bg-lime-400/[0.06] px-3 py-2"
              >
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-lime-300">
                  <TokenIcon className="h-3.5 w-3.5" /> Paid in ETH
                </span>
                <button type="button" onClick={run} className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-white/50 hover:text-lime-300">
                  <RotateCcw className="h-3 w-3" /> Again
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="request"
                type="button"
                onClick={run}
                disabled={started}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-2.5 text-[12.5px] font-semibold transition",
                  started ? "bg-white/[0.06] text-white/50" : "bg-lime-400 text-ink-950 shadow-glow hover:bg-lime-300",
                )}
              >
                <Send className="h-3.5 w-3.5" /> {started ? "Processing…" : "Request payout"}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Screen>
  );
}
