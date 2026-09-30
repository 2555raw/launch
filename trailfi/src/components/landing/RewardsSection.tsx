"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, Info } from "lucide-react";
import { DemoBadge } from "@/components/ui/Badge";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { DEMO_STATS } from "@/lib/demo-data";
import { fmtSteps } from "@/lib/format";
import { Reveal, SectionHeading } from "./Reveal";

const FLOW = [
  { k: "Eligible fees", v: "100 USDC", sub: "collected by the platform today" },
  { k: "Reward share", v: "30%", sub: "set by governance / admin" },
  { k: "Daily pool", v: "30 USDC", sub: "split by verified steps", accent: true },
];

export function RewardsSection() {
  const progress = DEMO_STATS.stepsToday / DEMO_STATS.dailyGoal;
  return (
    <section id="rewards" className="relative scroll-mt-24 overflow-hidden py-28 sm:py-36">
      <div className="pointer-events-none absolute right-0 top-1/3 h-[520px] w-[520px] rounded-full bg-lime-400/[0.07] blur-[140px]" />
      <div className="container relative grid items-center gap-16 lg:grid-cols-2">
        <div>
          <SectionHeading index="02" label="Rewards" title="Real fees," accent="shared with the people who move.">
            A configurable percentage of eligible platform fees becomes a daily reward pool. Everyone who reaches the
            daily goal with verified activity gets a share proportional to their valid steps, up to a per-user cap.
          </SectionHeading>

          <Reveal delay={0.15} className="mt-10 space-y-3">
            {FLOW.map((f, i) => (
              <div key={f.k} className="flex items-center gap-3">
                <div
                  className={`flex flex-1 items-center justify-between rounded-2xl border px-5 py-4 ${
                    f.accent ? "border-lime-400/30 bg-lime-400/[0.07]" : "border-white/10 bg-white/[0.035]"
                  }`}
                >
                  <div>
                    <div className="label !text-[10px]">{f.k}</div>
                    <div className="mt-0.5 text-[12.5px] text-white/45">{f.sub}</div>
                  </div>
                  <div className={`font-display text-2xl font-bold tabular ${f.accent ? "text-lime-300" : ""}`}>{f.v}</div>
                </div>
                {i < FLOW.length - 1 && <ArrowRight className="hidden h-4 w-4 shrink-0 text-white/25 sm:block" />}
              </div>
            ))}
            <p className="flex gap-2 pt-2 text-[13px] leading-relaxed text-white/45">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Illustrative example. Rewards depend on actual eligible fees and total verified activity, are reviewed
              before payment, and are never guaranteed.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="relative">
          <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-lime-400/25 via-transparent to-neon/10 opacity-60 blur-2xl" />
          <div className="glass-strong relative overflow-hidden rounded-[32px] p-7 sm:p-9">
            <div className="pointer-events-none absolute inset-0 bg-grid-fade bg-[size:28px_28px] opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="label">Rewards · today</div>
                  <h3 className="mt-2 font-display text-3xl font-bold tracking-tight">Your Daily Rewards</h3>
                </div>
                <DemoBadge />
              </div>

              <div className="mt-8 flex flex-col items-center gap-8 sm:flex-row">
                <ProgressRing value={progress} size={176} stroke={13} id="rewards-ring">
                  <div>
                    <motion.div
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 1.4, type: "spring", stiffness: 260, damping: 14 }}
                      className="mx-auto mb-1 grid h-7 w-7 place-items-center rounded-full bg-lime-400 text-forest-950"
                    >
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </motion.div>
                    <div className="font-display text-3xl font-bold tabular">{Math.round(progress * 100)}%</div>
                    <div className="font-mono text-[9.5px] uppercase tracking-widest text-lime-300/80">Goal reached</div>
                  </div>
                </ProgressRing>

                <dl className="grid w-full flex-1 grid-cols-2 gap-3">
                  <Stat label="Total Steps" value={fmtSteps(DEMO_STATS.stepsToday)} />
                  <Stat label="Daily Goal" value={fmtSteps(DEMO_STATS.dailyGoal)} />
                  <Stat label="Estimated Earnings" value={`$${DEMO_STATS.estimatedRewards.toFixed(2)}`} accent />
                  <Stat label="Total Earned" value={`$${DEMO_STATS.totalEarned.toFixed(2)}`} />
                </dl>
              </div>

              <div className="mt-8 rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="text-white/55">Your share of today&apos;s pool</span>
                  <span className="font-mono text-white/80 tabular">16.1%</span>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-lime-400 to-neon"
                    initial={{ width: 0 }}
                    whileInView={{ width: "16.1%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.4, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <p className="mt-3 text-[11.5px] leading-relaxed text-white/40">
                  Demonstration values until the backend is connected. Estimated earnings are a projection, not a
                  guaranteed payment.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-lime-400/25 bg-lime-400/[0.07]" : "border-white/10 bg-white/[0.035]"}`}>
      <dt className="label !text-[9.5px]">{label}</dt>
      <dd className={`mt-1.5 font-display text-xl font-bold tabular sm:text-2xl ${accent ? "text-lime-300" : ""}`}>{value}</dd>
    </div>
  );
}
