"use client";

import { motion } from "framer-motion";
import { Flame, Footprints, Mountain, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { useCountUp } from "@/hooks/useCountUp";
import { useUtcMidnightCountdown } from "@/hooks/useCountdown";
import { DEMO_STATS } from "@/lib/demo-data";
import { fmtSteps } from "@/lib/format";

const BARS = [42, 55, 38, 61, 72, 48, 66, 80, 58, 74, 69, 88, 64, 92];

export function HeroStatsCard() {
  const steps = useCountUp(DEMO_STATS.stepsToday, 1800);
  const reward = useCountUp(DEMO_STATS.estimatedRewards, 2000);
  const countdown = useUtcMidnightCountdown();
  const pct = DEMO_STATS.stepsToday / DEMO_STATS.dailyGoal;

  return (
    <div className="relative w-full max-w-[400px]">
      {/* Floating chips */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.6 }}
        className="glass-strong absolute -left-3 -top-6 z-10 hidden items-center gap-2 rounded-2xl px-3 py-2 shadow-glow sm:flex lg:-left-12"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-lime-400/15 text-lime-300">
          <TrendingUp className="h-3.5 w-3.5" />
        </span>
        <div className="leading-tight">
          <div className="font-mono text-[12px] font-semibold text-lime-300">+0.42 USDC</div>
          <div className="text-[10.5px] text-white/50">reward accrued</div>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.9 }}
        className="glass-strong absolute -bottom-5 -right-2 z-10 hidden items-center gap-2 rounded-2xl px-3 py-2 sm:flex lg:-right-6"
      >
        <Flame className="h-4 w-4 text-orange-300" />
        <span className="text-[12px] font-medium text-white/85">6 day streak</span>
      </motion.div>

      <div className="animate-float">
        <div className="relative overflow-hidden rounded-[30px] border border-white/[0.12] bg-ink-900/55 p-6 shadow-glass backdrop-blur-2xl backdrop-saturate-150">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-lime-400/15 blur-3xl" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-neon shadow-neon" />
              <span className="label !text-white/60">Today · live</span>
            </div>
            <Badge tone="lime">Goal reached</Badge>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <div>
              <div className="font-display text-[52px] font-bold leading-none tracking-tight tabular">
                {fmtSteps(steps)}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-sm text-white/60">
                <Footprints className="h-4 w-4 text-lime-400" /> Steps Today
              </div>
            </div>
            <ProgressRing value={pct} size={104} stroke={9} id="hero-ring">
              <div>
                <div className="font-display text-xl font-bold tabular">{Math.round(pct * 100)}%</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-white/45">goal</div>
              </div>
            </ProgressRing>
          </div>

          {/* 14-day activity bars */}
          <div className="mt-6 flex h-16 items-end gap-[5px]" aria-hidden>
            {BARS.map((h, i) => (
              <motion.div
                key={i}
                className={
                  i === BARS.length - 1
                    ? "flex-1 rounded-sm bg-gradient-to-t from-lime-500 to-neon shadow-[0_0_12px_rgba(93,255,157,0.5)]"
                    : "flex-1 rounded-sm bg-white/15"
                }
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: 1 + i * 0.04, duration: 0.6, ease: "easeOut" }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[9.5px] uppercase tracking-widest text-white/35">
            <span>14 days</span>
            <span>today</span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-lime-400/20 bg-lime-400/[0.07] p-4">
              <div className="label !text-[10px] !text-lime-300/80">Estimated Rewards</div>
              <div className="mt-1.5 font-display text-2xl font-bold text-lime-300 tabular">${reward.toFixed(2)}</div>
              <div className="mt-0.5 text-[10.5px] text-white/45">USDC · not guaranteed</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="label !text-[10px]">Daily Goal</div>
              <div className="mt-1.5 font-display text-2xl font-bold tabular">{Math.round(pct * 100)}%</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-lime-400 to-neon"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(1, pct) * 100}%` }}
                  transition={{ delay: 1.2, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <div className="mt-1.5 text-[10.5px] text-white/45 tabular">
                {fmtSteps(DEMO_STATS.stepsToday)} / {fmtSteps(DEMO_STATS.dailyGoal)}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <div className="flex items-center gap-2 text-[12.5px] text-white/60">
              <Mountain className="h-4 w-4 text-white/40" /> Distribution window closes
            </div>
            <span className="font-mono text-[13px] font-medium text-white tabular">{countdown}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
