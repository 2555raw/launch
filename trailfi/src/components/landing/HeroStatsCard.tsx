"use client";

import { motion } from "framer-motion";
import { Coins, Footprints, Mountain, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { useCountUp } from "@/hooks/useCountUp";
import { useUtcMidnightCountdown } from "@/hooks/useCountdown";
import { fmtAmount, fmtSteps } from "@/lib/format";
import { usePublicStats } from "./usePublicStats";
import { TokenIcon } from "@/components/ui/TokenIcon";

/** Live community card in the hero. Every number comes from the database. */
export function HeroStatsCard() {
  const { data } = usePublicStats();
  const today = data?.today ?? { walkers: 0, steps: 0, goalMet: 0 };
  const steps = useCountUp(today.steps, 1800);
  const paid = useCountUp(data?.paid.total ?? 0, 2000);
  const countdown = useUtcMidnightCountdown();
  const goalShare = today.walkers ? today.goalMet / today.walkers : 0;
  const series = data?.series ?? [];
  const peak = Math.max(1, ...series.map((d) => d.steps));
  const token = data?.tokenSymbol ?? "USDG";

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
          <Users className="h-3.5 w-3.5" />
        </span>
        <div className="leading-tight">
          <div className="font-mono text-[12px] font-semibold text-lime-300">{(data?.walkers ?? 0).toLocaleString("en-US")}</div>
          <div className="text-[10.5px] text-white/50">walkers joined</div>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.9 }}
        className="glass-strong absolute -bottom-5 -right-2 z-10 hidden items-center gap-2 rounded-2xl px-3 py-2 sm:flex lg:-right-6"
      >
        <Coins className="h-4 w-4 text-lime-300" />
        <span className="text-[12px] font-medium text-white/85">{(data?.paid.count ?? 0).toLocaleString("en-US")} payouts sent</span>
      </motion.div>

      <div className="animate-float">
        <div className="relative overflow-hidden rounded-[30px] border border-white/[0.12] bg-ink-900/55 p-6 shadow-glass backdrop-blur-2xl backdrop-saturate-150">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-lime-400/15 blur-3xl" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-neon shadow-neon" />
              <span className="label !text-white/60">Community · today</span>
            </div>
            <Badge tone="lime">Live</Badge>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <div>
              <div className="font-display text-[52px] font-bold leading-none tracking-tight tabular">{fmtSteps(steps)}</div>
              <div className="mt-2 flex items-center gap-1.5 text-sm text-white/60">
                <Footprints className="h-4 w-4 text-lime-400" /> Steps logged today
              </div>
            </div>
            <ProgressRing value={goalShare} size={104} stroke={9} id="hero-ring">
              <div>
                <div className="font-display text-xl font-bold tabular">{Math.round(goalShare * 100)}%</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-white/45">hit goal</div>
              </div>
            </ProgressRing>
          </div>

          {/* Community steps over the last 14 days */}
          <div className="mt-6 flex h-16 items-end gap-[5px]" aria-hidden>
            {(series.length ? series : Array.from({ length: 14 }, () => ({ steps: 0 }))).map((d, i, all) => (
              <motion.div
                key={i}
                className={
                  i === all.length - 1
                    ? "flex-1 rounded-sm bg-gradient-to-t from-lime-500 to-neon shadow-[0_0_12px_rgba(93,255,157,0.5)]"
                    : "flex-1 rounded-sm bg-white/15"
                }
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (d.steps / peak) * 100)}%` }}
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
              <div className="label !text-[10px] !text-lime-300/80">Paid to walkers</div>
              <div className="mt-1.5 font-display text-2xl font-bold text-lime-300 tabular">${fmtAmount(paid)}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-white/45">
                <TokenIcon symbol={token} className="h-3.5 w-3.5" /> {token} · all time
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="label !text-[10px]">Walking today</div>
              <div className="mt-1.5 font-display text-2xl font-bold tabular">{today.walkers.toLocaleString("en-US")}</div>
              <div className="mt-0.5 text-[10.5px] text-white/45">
                goal {fmtSteps(data?.dailyGoal ?? 10_000)} steps
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
            <div className="flex items-center gap-2 text-[12.5px] text-white/60">
              <Mountain className="h-4 w-4 text-white/40" /> Today closes in
            </div>
            <span className="font-mono text-[13px] font-medium text-white tabular">{countdown}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
