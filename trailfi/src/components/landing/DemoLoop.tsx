"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, Check, Footprints, Upload, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { cn } from "@/lib/cn";
import { Reveal, SectionHeading } from "./Reveal";

const STEPS = 10_871;
const LOOP = 15; // seconds
const SCENES = [
  { id: "walk", from: 0, to: 4, label: "Walk", body: "Your phone counts every step.", icon: Footprints },
  { id: "shot", from: 4, to: 6, label: "Screenshot", body: "Capture the day's steps and the date.", icon: Camera },
  { id: "upload", from: 6, to: 10, label: "Upload", body: "Send it to Stepit in a couple of taps.", icon: Upload },
  { id: "paid", from: 10, to: LOOP, label: "Get paid", body: "Once verified, USDG lands in your wallet.", icon: Wallet },
] as const;

/** Seconds into the loop; pauses while the demo is off screen. */
function useLoopClock() {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const offset = useRef(0);
  useEffect(() => {
    if (!visible) return;
    // Real elapsed time, so the loop keeps its pace even when frames are dropped.
    const start = performance.now() - offset.current * 1000;
    let raf = 0;
    const tick = (now: number) => {
      offset.current = ((now - start) / 1000) % LOOP;
      setT(offset.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);
  return { ref, t };
}

/** The whole flow, walk to wallet, as a 15 second loop. */
export function DemoLoop() {
  const reduced = useReducedMotion();
  const { ref, t: clock } = useLoopClock();
  const t = reduced ? 13 : clock;
  const scene = SCENES.find((s) => t >= s.from && t < s.to) ?? SCENES[0];

  return (
    <section id="demo" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="container">
        <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <SectionHeading label="15 seconds" title="From your walk" accent="to your wallet.">
              No app to install and no tracker to buy. The phone in your pocket already counts your steps.
            </SectionHeading>

            <ol className="mt-10 space-y-3">
              {SCENES.map((s, i) => {
                const active = s.id === scene.id;
                const done = t >= s.to;
                const progress = active ? (t - s.from) / (s.to - s.from) : done ? 1 : 0;
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border px-4 py-3.5 transition-colors duration-300",
                      active ? "border-lime-400/40 bg-lime-400/[0.06]" : "border-white/[0.07] bg-white/[0.02]",
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <span
                        className={cn(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
                          active ? "bg-lime-400 text-ink-950" : done ? "bg-lime-400/15 text-lime-300" : "bg-white/5 text-white/40",
                        )}
                      >
                        <s.icon className="h-4 w-4" />
                      </span>
                      <div>
                        <div className={cn("text-[15px] font-semibold", active ? "text-white" : "text-white/60")}>
                          <span className="mr-2 font-mono text-[12px] text-white/35">{i + 1}</span>
                          {s.label}
                        </div>
                        <div className={cn("text-[13px]", active ? "text-white/65" : "text-white/35")}>{s.body}</div>
                      </div>
                    </div>
                    <span className="absolute bottom-0 left-0 h-[2px] bg-lime-400/80" style={{ width: `${progress * 100}%` }} />
                  </li>
                );
              })}
            </ol>
          </div>

          <Reveal>
            <div ref={ref} className="relative mx-auto w-full max-w-[420px]">
              <div className="pointer-events-none absolute inset-0 -z-10 m-auto h-80 w-80 rounded-full bg-lime-400/15 blur-[90px]" />
              <DemoPhone t={t} scene={scene.id} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function DemoPhone({ t, scene }: { t: number; scene: (typeof SCENES)[number]["id"] }) {
  const counted = Math.round(STEPS * Math.min(1, t / 3.2));
  return (
    <div className="relative mx-auto w-[280px] rounded-[48px] border border-white/15 bg-[#0b0c0d] p-[10px] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)]">
      <div className="relative h-[560px] overflow-hidden rounded-[39px] bg-black">
        <span className="absolute left-1/2 top-2 z-30 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-black" />

        <AnimatePresence mode="popLayout">
          {(scene === "walk" || scene === "shot") && (
            <motion.div key="fitness" className="absolute inset-0" exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.4 }}>
              <FitnessScreen steps={scene === "walk" ? counted : STEPS} />
            </motion.div>
          )}
          {scene === "upload" && (
            <motion.div key="upload" className="absolute inset-0" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.4 }}>
              <UploadScreen t={t - 6} />
            </motion.div>
          )}
          {scene === "paid" && (
            <motion.div key="paid" className="absolute inset-0" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <PaidScreen t={t - 10} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Screenshot flash and the thumbnail it leaves behind */}
        <AnimatePresence>
          {scene === "shot" && t < 4.35 && (
            <motion.div key="flash" className="absolute inset-0 z-20 bg-white" initial={{ opacity: 0.95 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} />
          )}
          {scene === "shot" && t >= 4.35 && (
            <motion.div
              key="thumb"
              className="absolute bottom-6 left-4 z-20 h-[110px] w-[56px] overflow-hidden rounded-lg border-2 border-white shadow-2xl"
              initial={{ scale: 3.2, x: 90, y: -180, opacity: 0.6 }}
              animate={{ scale: 1, x: 0, y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="h-full w-full bg-black p-1">
                <div className="mx-auto mt-3 h-6 w-6 rounded-full border-[3px] border-[#fa114f]" />
                <div className="mt-2 text-center text-[6px] text-white/70">Steps</div>
                <div className="text-center text-[8px] font-semibold text-white">10,871</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FitnessScreen({ steps }: { steps: number }) {
  const ring = Math.min(1, steps / STEPS);
  return (
    <div className="h-full px-5 pt-12 text-white">
      <div className="text-center text-[13px] font-semibold">Saturday, Oct 3</div>
      <div className="mx-auto mt-8 grid h-[150px] w-[150px] place-items-center rounded-full" style={{ background: `conic-gradient(#fa114f ${ring * 330}deg, rgba(250,17,79,0.16) 0)` }}>
        <span className="h-[96px] w-[96px] rounded-full bg-black" />
      </div>
      <div className="mt-8 text-[12px] text-white/80">Move</div>
      <div className="text-[20px] font-semibold text-[#fa114f]">
        {Math.round(329 * ring)}/360<span className="text-[12px]"> KCAL</span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[12px] text-white/80">Steps</div>
          <div className="font-mono text-[28px] font-medium leading-tight text-[#d1d1d6] tabular-nums">{steps.toLocaleString("en-US")}</div>
        </div>
        <div>
          <div className="text-[12px] text-white/80">Distance</div>
          <div className="text-[28px] font-medium leading-tight text-[#d1d1d6]">
            {(8.48 * ring).toFixed(2)}
            <span className="text-[14px]"> KM</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadScreen({ t }: { t: number }) {
  const typed = "10871".slice(0, Math.max(0, Math.min(5, Math.floor((t - 0.4) * 6))));
  const attached = t > 1.3;
  const pressed = t > 2.4;
  const sent = t > 2.9;
  return (
    <div className="h-full bg-ink-950 px-4 pt-12 text-white">
      <div className="flex items-center gap-2 text-[13px] font-bold">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-forest-800 text-lime-300">
          <Footprints className="h-3.5 w-3.5" />
        </span>
        Step<span className="-ml-2 text-lime-400">it</span>
      </div>
      <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/45">Upload steps</div>
      <div className="mt-1 text-[18px] font-bold">Log your day</div>

      <div className="mt-4 flex gap-1.5">
        {[["Wed", 30], ["Thu", 1], ["Fri", 2], ["Sat", 3]].map(([d, n], i) => (
          <span key={d} className={cn("flex-1 rounded-lg border py-1.5 text-center text-[9px]", i === 3 ? "border-lime-400/60 bg-lime-400/10 text-lime-300" : "border-white/10 text-white/45")}>
            {d}
            <span className="block text-[12px] font-semibold">{n}</span>
          </span>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-[16px]">
        {typed ? Number(typed).toLocaleString("en-US") : <span className="text-white/25">Steps</span>}
        {!attached && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-lime-400" />}
      </div>

      <div className={cn("mt-3 flex items-center gap-3 rounded-xl border p-2.5 transition-colors", attached ? "border-lime-400/30 bg-lime-400/[0.06]" : "border-dashed border-white/15")}>
        {attached ? (
          <>
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="h-12 w-8 rounded-md border border-white/20 bg-black p-0.5">
              <div className="mx-auto mt-1.5 h-3.5 w-3.5 rounded-full border-2 border-[#fa114f]" />
            </motion.div>
            <span className="flex items-center gap-1 text-[11px] text-lime-200">
              <Check className="h-3.5 w-3.5" /> Screenshot ready
            </span>
          </>
        ) : (
          <span className="py-3 text-[11px] text-white/40">Add a screenshot</span>
        )}
      </div>

      <motion.div
        animate={{ scale: pressed && !sent ? 0.96 : 1 }}
        className={cn("mt-4 rounded-xl py-3 text-center text-[13px] font-semibold", sent ? "bg-lime-400/15 text-lime-300" : "bg-lime-400 text-ink-950")}
      >
        {sent ? "Uploaded · in review" : "Upload steps"}
      </motion.div>
    </div>
  );
}

function PaidScreen({ t }: { t: number }) {
  const verified = t > 0.3;
  const paid = t > 1.6;
  return (
    <div className="flex h-full flex-col items-center bg-ink-950 px-5 pt-16 text-white">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: verified ? 1 : 0.6, opacity: verified ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
        className="flex items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-lime-300"
      >
        <Check className="h-3.5 w-3.5" /> Verified
      </motion.div>
      <div className="mt-4 text-[12px] text-white/50">Sat, Oct 3 · 10,871 steps</div>

      <AnimatePresence>
        {paid && (
          <motion.div key="amount" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 18 }} className="mt-10 flex flex-col items-center">
            <div className="relative">
              <TokenIcon symbol="USDG" className="!h-16 !w-16" />
              {Array.from({ length: 10 }).map((_, i) => (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-lime-300"
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{ x: Math.cos((i / 10) * Math.PI * 2) * 70, y: Math.sin((i / 10) * Math.PI * 2) * 70, opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              ))}
            </div>
            <div className="mt-5 font-display text-[44px] font-bold leading-none text-lime-300">+$5.00</div>
            <div className="mt-1.5 text-[13px] text-white/60">USDG received</div>
          </motion.div>
        )}
      </AnimatePresence>

      {paid && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-auto mb-8 w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-lime-400/15 text-lime-300">
              <Wallet className="h-4 w-4" />
            </span>
            <div className="text-[11px] leading-tight">
              <div className="font-semibold">Your wallet</div>
              <div className="font-mono text-white/45">0x8f3a…a21c · Robinhood Chain</div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
