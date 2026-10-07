"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const HOURS = [0, 0, 0, 0, 0, 0, 0, 8, 46, 62, 30, 12, 18, 40, 24, 10, 6, 52, 34, 20, 8, 0, 0, 0];
const MOVE = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 14, 70, 52, 88, 30, 0, 0, 0, 74, 0, 64, 0];

/** Numbered marker placed on the phone, matched by the list next to it. */
function Marker({ n, className }: { n: number; className: string }) {
  return (
    <span
      className={cn(
        "absolute z-10 grid h-6 w-6 place-items-center rounded-full bg-lime-400 font-mono text-[11px] font-bold text-ink-950 shadow-[0_0_0_4px_rgba(77,148,255,0.25)]",
        className,
      )}
    >
      {n}
    </span>
  );
}

/** Lime outline around the part of the screen that must be visible. */
function Mark({ n, children, className, markerClass = "-right-8 top-1/2 -translate-y-1/2" }: { n: number; children: ReactNode; className?: string; markerClass?: string }) {
  return (
    <div className={cn("relative w-fit", className)}>
      {children}
      <span className="pointer-events-none absolute -inset-x-1.5 -inset-y-0.5 rounded-md border-2 border-lime-400" />
      <Marker n={n} className={markerClass} />
    </div>
  );
}

function Phone({ dark, children }: { dark?: boolean; children: ReactNode }) {
  return (
    <div className="relative mx-auto w-[236px] rounded-[42px] border border-white/15 bg-[#0b0c0d] p-[9px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)]">
      <div className={cn("relative h-[470px] overflow-hidden rounded-[34px]", dark ? "bg-black text-white" : "bg-white text-[#1c1c1e]")}>
        <div className="flex items-center justify-between px-6 pb-1 pt-2.5 text-[10px] font-semibold">
          <span>0:23</span>
          <span className="absolute left-1/2 top-1.5 h-[18px] w-[78px] -translate-x-1/2 rounded-full bg-black" />
          <span className={cn("h-[7px] w-[14px] rounded-[2px] border", dark ? "border-white/70" : "border-[#1c1c1e]/70")} />
        </div>
        {children}
      </div>
    </div>
  );
}

/** iPhone Fitness app, Summary of one day. */
function FitnessScreen() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <Phone dark>
      <div className="px-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#3d8bff]">‹</span>
          <Mark n={1} markerClass="-bottom-7 left-1/2 -translate-x-1/2">
            <span className="text-[11.5px] font-semibold">Saturday, Oct 3, 2026</span>
          </Mark>
          <span className="h-3 w-3 rounded-[3px] border border-[#3d8bff]" />
        </div>
        <div className="mt-8 flex justify-between px-1">
          {days.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className={cn("text-[7px]", i === 5 ? "grid h-3.5 w-3.5 place-items-center rounded-full bg-white/30" : "text-white/50")}>{d}</span>
              <span
                className="grid h-5 w-5 place-items-center rounded-full"
                style={{ background: `conic-gradient(#fa114f ${[0.92, 0.8, 0.86, 0.6, 0.83, 0.91, 0.05][i] * 360}deg, rgba(250,17,79,0.18) 0)` }}
              >
                <span className="h-[13px] w-[13px] rounded-full bg-black" />
              </span>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-4 grid h-[112px] w-[112px] place-items-center rounded-full" style={{ background: "conic-gradient(#fa114f 329deg, rgba(250,17,79,0.18) 0)" }}>
          <span className="h-[68px] w-[68px] rounded-full bg-black" />
        </div>
        <div className="mt-3 text-[9px]">Move</div>
        <div className="text-[16px] font-semibold leading-tight text-[#fa114f]">
          329/360<span className="text-[10px]"> KCAL</span>
        </div>
        <div className="mt-1.5 flex h-[34px] items-end gap-[2px] border-b border-dotted border-[#fa114f]/60">
          {MOVE.map((h, i) => (
            <span key={i} className="flex-1 bg-[#fa114f]" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2">
          <Mark n={2} markerClass="-right-8 top-1/2 -translate-y-1/2">
            <div className="text-[9px]">Steps</div>
            <div className="text-[20px] font-medium leading-tight text-[#c7c7cc]">10,871</div>
          </Mark>
          <div className="pl-5">
            <div className="text-[9px]">Distance</div>
            <div className="text-[20px] font-medium leading-tight text-[#c7c7cc]">
              8.48<span className="text-[11px]"> KM</span>
            </div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

/** iPhone Health app, Summary with the Steps highlight. */
function HealthScreen() {
  const dots = [70, 78, 66, 60, 60, 52, 46, 40, 42, 38, 40, 30, 28, 34, 28, 36, 30, 32, 24, 26, 20, 22, 18, 16, 14, 12, 20, 26, 24, 16, 18, 12];
  return (
    <Phone>
      <div className="bg-[#f2f2f7] px-3 pb-20 pt-1">
        <div className="text-center text-[10px] font-semibold">Summary</div>
        <div className="mt-2 text-[15px] font-bold">Highlights</div>
        <div className="mt-2 rounded-xl bg-white p-2.5">
          <div className="text-[8px] font-semibold text-[#ff2d55]">♥ Heart rate: after workout</div>
          <div className="mt-1 text-[8.5px] font-semibold leading-snug">In the three minutes after your last yoga workout, your heart rate dropped 21 BPM.</div>
          <div className="relative mt-2 h-[52px] border-l border-[#e5e5ea]">
            {dots.map((y, i) => (
              <span key={i} className="absolute h-[3px] w-[3px] rounded-full bg-[#ff2d55]" style={{ left: `${(i / dots.length) * 88}%`, top: `${92 - y}%` }} />
            ))}
          </div>
        </div>
        <div className="mt-2.5 rounded-xl bg-white p-2.5">
          <div className="text-[8.5px] font-semibold text-[#ff6a00]">🔥 Steps</div>
          <div className="mt-1 text-[9px] font-semibold leading-snug">You&apos;re walking less than on a usual day.</div>
          <div className="mt-2 grid grid-cols-2 border-t border-[#e5e5ea] pt-2">
            <div>
              <Mark n={1} markerClass="-right-7 top-1/2 -translate-y-1/2">
                <span className="text-[8px] font-semibold text-[#ff6a00]">● Today</span>
              </Mark>
              <Mark n={2} className="mt-1.5" markerClass="-bottom-6 left-1/2 -translate-x-1/2">
                <span className="text-[16px] font-bold leading-none text-[#ff6a00]">3,105</span>
                <span className="text-[8px] font-semibold text-[#ff6a00]"> steps</span>
              </Mark>
            </div>
            <div className="pl-2">
              <span className="text-[8px] font-semibold text-[#8e8e93]">● Average</span>
              <div className="mt-1.5">
                <span className="text-[16px] font-bold leading-none text-[#8e8e93]">5,321</span>
                <span className="text-[8px] font-semibold text-[#8e8e93]"> steps</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Floating tab bar */}
      <div className="absolute inset-x-2.5 bottom-3 flex items-center justify-between">
        <div className="flex rounded-full bg-white/90 p-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
          <span className="rounded-full bg-[#eeeef0] px-3 py-1 text-[7.5px] font-semibold text-[#007aff]">♥ Summary</span>
          <span className="px-3 py-1 text-[7.5px] font-semibold">Sharing</span>
        </div>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.12)]">⌕</span>
      </div>
    </Phone>
  );
}

/** Android step counter (Google Fit, Samsung Health), one day. */
function AndroidScreen() {
  return (
    <Phone>
      <div className="px-4 pt-2">
        <div className="flex items-center justify-between text-[11px] font-medium">
          <span className="text-[#1a73e8]">←</span>
          <span>Steps</span>
          <span className="text-[#5f6368]">⋮</span>
        </div>
        <Mark n={1} className="mx-auto mt-4" markerClass="-right-8 top-1/2 -translate-y-1/2">
          <span className="text-[11px] font-medium text-[#3c4043]">‹ Sat, Oct 3 ›</span>
        </Mark>
        <div className="relative mx-auto mt-5 h-[128px] w-[128px] rounded-full" style={{ background: "conic-gradient(#1a73e8 300deg, #e8eaed 0)" }}>
          <div className="absolute inset-[10px] grid place-items-center rounded-full bg-white">
            <Mark n={2} markerClass="-right-9 top-1/2 -translate-y-1/2">
              <div className="text-center">
                <div className="text-[22px] font-semibold leading-none">9,214</div>
                <div className="mt-1 text-[8.5px] text-[#5f6368]">steps</div>
              </div>
            </Mark>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 text-center text-[8px] text-[#5f6368]">
          {[
            ["6.9", "km"],
            ["342", "kcal"],
            ["74", "min"],
          ].map(([v, u]) => (
            <div key={u}>
              <div className="text-[13px] font-semibold text-[#202124]">{v}</div>
              {u}
            </div>
          ))}
        </div>
        <div className="mt-5 flex h-[60px] items-end gap-[3px]">
          {HOURS.map((h, i) => (
            <span key={i} className="flex-1 rounded-t-[2px] bg-[#1a73e8]/80" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[6.5px] text-[#5f6368]">
          <span>12 AM</span>
          <span>12 PM</span>
          <span>11 PM</span>
        </div>
      </div>
    </Phone>
  );
}

const GUIDES = [
  {
    id: "fitness",
    tab: "iPhone · Fitness",
    screen: <FitnessScreen />,
    steps: [
      "Open the Fitness app and stay on Summary.",
      "Tap your Activity rings. Use the calendar at the top to pick the day.",
      "Scroll down until Steps shows, with the date still at the top.",
      "Take the screenshot: side button + volume up.",
    ],
  },
  {
    id: "health",
    tab: "iPhone · Health",
    screen: <HealthScreen />,
    steps: [
      "Open the Health app on Summary.",
      "Uploading today? The Steps card in Highlights shows Today and your steps. That's enough.",
      "For an earlier day, tap the Steps card, pick D (day) and swipe to that day so its date shows.",
      "Take the screenshot: side button + volume up.",
    ],
  },
  {
    id: "android",
    tab: "Android",
    screen: <AndroidScreen />,
    steps: [
      "Open Google Fit, Samsung Health or your watch app (Fitbit, Garmin).",
      "Tap Steps and pick the day.",
      "Check that the day's total and the date are both on screen.",
      "Take the screenshot: power + volume down.",
    ],
  },
];

/** Step-by-step guide to the screenshot, one tab per phone, on the upload page. */
export function ScreenshotExample() {
  const [active, setActive] = useState(GUIDES[0].id);
  const guide = GUIDES.find((g) => g.id === active) ?? GUIDES[0];

  return (
    <section id="example" className="glass scroll-mt-24 overflow-hidden rounded-3xl">
      <div className="grid items-center gap-8 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:gap-12">
        <div className="relative">
          <div className="pointer-events-none absolute inset-0 -z-10 m-auto h-64 w-64 rounded-full bg-lime-400/15 blur-3xl" />
          <AnimatePresence mode="wait">
            <motion.div key={guide.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {guide.screen}
            </motion.div>
          </AnimatePresence>
        </div>

        <div>
          <div className="label">Tutorial</div>
          <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight">How to take your screenshot</h2>
          <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-white/55">
            Any app that counts steps works. The photo needs <span className="text-lime-300">① the date</span> and{" "}
            <span className="text-lime-300">② the day&apos;s steps</span>, and we check them against what you type.
          </p>

          <div className="mt-5 inline-flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1 text-[13px]">
            {GUIDES.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActive(g.id)}
                className={cn("relative rounded-xl px-3.5 py-1.5 font-medium transition", active === g.id ? "text-ink-950" : "text-white/60 hover:text-white")}
              >
                {active === g.id && <motion.span layoutId="guide-tab" className="absolute inset-0 rounded-xl bg-lime-400" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                <span className="relative">{g.tab}</span>
              </button>
            ))}
          </div>

          <ol className="mt-5 space-y-3">
            {guide.steps.map((s, i) => (
              <li key={s} className="flex gap-3.5 text-[14px] leading-snug">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 font-mono text-[11px] text-white/60">{i + 1}</span>
                <span className="text-white/75">{s}</span>
              </li>
            ))}
          </ol>

          <div className="mt-6 grid gap-2 border-t border-white/[0.07] pt-5 text-[13px] sm:grid-cols-2">
            {["Full screenshot, straight from your phone", "One screenshot per day"].map((t) => (
              <span key={t} className="flex items-center gap-2 text-white/70">
                <Check className="h-4 w-4 shrink-0 text-lime-400" /> {t}
              </span>
            ))}
            {["Cropped or edited images", "Photos of another screen"].map((t) => (
              <span key={t} className="flex items-center gap-2 text-white/45">
                <X className="h-4 w-4 shrink-0 text-red-300/80" /> {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
