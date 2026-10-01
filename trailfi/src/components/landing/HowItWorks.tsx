"use client";

import { animate, motion, useInView, useMotionTemplate, useMotionValue, useReducedMotion } from "framer-motion";
import { Check, Coins, Footprints, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
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
    body: "Sync from Apple Health or Google Health Connect. Only verified activity counts.",
    icon: Footprints,
    tags: ["Daily goal", "Verified"],
    Visual: StepsVisual,
  },
  {
    n: "03",
    stage: "Summit",
    title: "Earn rewards",
    body: "Paid from the $STEPIT trading fees. Request a payout and it lands in your wallet after review.",
    icon: Coins,
    tags: ["Stablecoin", "Onchain"],
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
          No lockups, no staking, nothing to buy. Walk, sync your activity, and collect your share.
        </SectionHeading>

        {/* Progress rail: fills from the first stage to the last as it scrolls into view. */}
        <div ref={rail} className="relative mt-16 hidden h-10 md:block" aria-hidden>
          <div className="absolute left-[16.66%] right-[16.66%] top-1/2 h-px -translate-y-1/2 bg-white/10" />
          <motion.div
            className="absolute left-[16.66%] right-[16.66%] top-1/2 h-px origin-left -translate-y-1/2 bg-gradient-to-r from-lime-400 via-lime-300 to-neon shadow-[0_0_12px_rgba(196,251,109,0.7)]"
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
  // Soft lime spotlight that follows the cursor.
  const mx = useMotionValue(-400);
  const my = useMotionValue(-400);
  const spotlight = useMotionTemplate`radial-gradient(340px circle at ${mx}px ${my}px, rgba(196,251,109,0.10), transparent 70%)`;

  return (
    <div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(e.clientX - r.left);
        my.set(e.clientY - r.top);
      }}
      onMouseLeave={() => {
        mx.set(-400);
        my.set(-400);
      }}
      className="group relative h-full rounded-3xl bg-gradient-to-b from-white/[0.14] via-white/[0.05] to-white/[0.02] p-px transition duration-500 hover:-translate-y-1.5 hover:from-lime-400/50 hover:via-lime-400/10"
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[23px] bg-ink-900/95 p-6 sm:p-7">
        <motion.div className="pointer-events-none absolute inset-0" style={{ background: spotlight }} />

        <s.Visual />

        <div className="relative mt-7 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-lime-400/25 bg-forest-800/80 text-lime-300 shadow-[0_0_24px_-6px_rgba(178,240,71,0.6)] transition duration-500 group-hover:rotate-[-6deg] group-hover:scale-110">
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
    </div>
  );
}

/** Inset "screen" that holds each card's mini product preview. */
function Screen({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative h-[168px] overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-950/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]", className)}>
      <div className="pointer-events-none absolute inset-0 bg-grid-fade bg-[size:22px_22px] opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

/** Advances 0 → max one stage at a time once the element is on screen. */
function useStages(max: number, every: number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setStage(max);
      return;
    }
    const timers = Array.from({ length: max }, (_, i) => setTimeout(() => setStage(i + 1), 500 + i * every));
    return () => timers.forEach(clearTimeout);
  }, [inView, reduce, max, every]);
  return { ref, stage };
}

const WALLETS = [
  { name: "Phantom", logo: "/wallets/phantom.svg", glow: "#ab9ff2" },
  { name: "MetaMask", logo: "/wallets/metamask.svg", glow: "#f6851b" },
  { name: "Coinbase", logo: "/wallets/coinbase.svg", glow: "#0052ff" },
  { name: "Rabby", logo: "/wallets/rabby.svg", glow: "#7084ff" },
];

function WalletVisual() {
  const { ref, stage } = useStages(3, 700);
  return (
    <Screen>
      <div ref={ref} className="flex h-full flex-col">
        <div className="grid grid-cols-4 gap-2">
          {WALLETS.map((w, i) => (
            <div
              key={w.name}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2 transition duration-500",
                stage >= 1 && i === 0 ? "border-lime-400/50 bg-lime-400/[0.08]" : "border-white/[0.06] bg-white/[0.02]",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.logo} alt="" className="h-7 w-7 rounded-lg" style={{ boxShadow: `0 0 14px -4px ${w.glow}` }} />
              <span className="text-[9.5px] text-white/55">{w.name}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto space-y-2">
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border px-3 py-2 text-[12px] transition duration-500",
              stage >= 2 ? "border-lime-400/30 bg-lime-400/[0.06]" : "border-white/[0.06] bg-white/[0.02]",
            )}
          >
            <span className="flex items-center gap-2">
              <span className={cn("h-1.5 w-1.5 rounded-full transition", stage >= 2 ? "bg-neon shadow-neon" : "bg-white/25")} />
              <span className="font-mono text-white/80">{stage >= 2 ? "0x7a3f…c21e" : "Connecting…"}</span>
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

const WEEK = [0.42, 0.66, 0.55, 0.9, 0.72, 1, 0.84];

function StepsVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const [count, setCount] = useState(0);
  const target = 8432;

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setCount(target);
      return;
    }
    const controls = animate(0, target, { duration: 2.2, delay: 0.4, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setCount(Math.round(v)) });
    return () => controls.stop();
  }, [inView, reduce]);

  return (
    <Screen>
      <div ref={ref} className="flex h-full flex-col">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">Today</div>
            <div className="mt-0.5 font-display text-[26px] font-bold leading-none tabular-nums">{count.toLocaleString("en-US")}</div>
          </div>
          <span className="flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/[0.07] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-widest text-lime-300">
            <Check className="h-3 w-3" /> Verified
          </span>
        </div>
        <div className="relative mt-auto flex h-[78px] items-end gap-2">
          <div className="pointer-events-none absolute inset-x-0 top-[18%] border-t border-dashed border-lime-400/30">
            <span className="absolute -top-2.5 left-0 bg-ink-950 pr-1 font-mono text-[9px] uppercase tracking-widest text-lime-400/70">Goal</span>
          </div>
          {WEEK.map((h, i) => (
            <motion.div
              key={i}
              className={cn("flex-1 origin-bottom rounded-t-md", i === WEEK.length - 1 ? "bg-gradient-to-t from-lime-500 to-lime-300" : "bg-white/[0.12]")}
              style={{ height: `${h * 100}%` }}
              initial={{ scaleY: 0 }}
              animate={inView ? { scaleY: 1 } : {}}
              transition={{ delay: 0.2 + i * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex gap-2 font-mono text-[9px] text-white/30">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
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
  const { ref, stage } = useStages(3, 650);
  return (
    <Screen>
      <div ref={ref} className="flex h-full flex-col">
        <ol className="space-y-2.5">
          {PAYOUT_FLOW.map((label, i) => {
            const done = stage > i;
            return (
              <li key={label} className="flex items-center gap-3">
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition duration-500",
                    done ? "border-lime-400 bg-lime-400 text-ink-950 shadow-[0_0_14px_rgba(196,251,109,0.55)]" : "border-white/15 text-transparent",
                  )}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className={cn("text-[12.5px] transition duration-500", done ? "text-white/85" : "text-white/35")}>{label}</span>
              </li>
            );
          })}
        </ol>
        <div
          className={cn(
            "mt-auto flex items-center justify-between rounded-xl border border-lime-400/25 bg-lime-400/[0.06] px-3 py-2 transition duration-700",
            stage >= 3 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          )}
        >
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-lime-300">
            <span className="h-1.5 w-1.5 rounded-full bg-neon shadow-neon" /> Paid · Robinhood Chain
          </span>
          <span className="font-mono text-[11px] text-white/50">tx 0x9c4e…e41b</span>
        </div>
      </div>
    </Screen>
  );
}
