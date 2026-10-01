"use client";

import { motion } from "framer-motion";
import { Info, Upload, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { fmtAmount, fmtSteps } from "@/lib/format";
import { Reveal, SectionHeading } from "./Reveal";
import { usePublicStats } from "./usePublicStats";
import { TokenIcon } from "@/components/ui/TokenIcon";

// Where the money comes from: a fee on every $STEPIT trade.
const FLOW = [
  { k: "People trade $STEPIT", sub: "every buy and sell onchain" },
  { k: "A small fee on each trade", sub: "goes into the reward fund" },
  { k: "The fund pays walkers", sub: "based on verified steps", accent: true },
];

export function RewardsSection() {
  const { data } = usePublicStats();
  const today = data?.today ?? { walkers: 0, steps: 0, goalMet: 0 };
  const goalShare = today.walkers ? today.goalMet / today.walkers : 0;
  const token = data?.tokenSymbol ?? "USDG";

  return (
    <section id="rewards" className="relative scroll-mt-24 overflow-hidden py-28 sm:py-36">
      <div className="pointer-events-none absolute right-0 top-1/3 h-[520px] w-[520px] rounded-full bg-lime-400/[0.07] blur-[140px]" />
      <div className="container relative grid items-center gap-16 lg:grid-cols-2">
        <div>
          <SectionHeading index="02" label="Rewards" title="Token fees," accent="paid to the people who move.">
            Every buy and sell of the $STEPIT token pays a small trading fee. Those fees fund the rewards paid to
            everyone who walks with verified activity. The more you move, the more you earn.
          </SectionHeading>

          <Reveal delay={0.15} className="mt-10 space-y-3">
            {FLOW.map((f, i) => (
              <div
                key={f.k}
                className={`flex items-center gap-4 rounded-2xl border px-5 py-4 ${
                  f.accent ? "border-lime-400/30 bg-lime-400/[0.07]" : "border-white/10 bg-white/[0.035]"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl font-mono text-[12px] font-bold ${
                    f.accent ? "bg-lime-400 text-ink-950" : "bg-white/[0.06] text-white/70"
                  }`}
                >
                  {i + 1}
                </span>
                <div>
                  <div className={`font-display text-lg font-semibold ${f.accent ? "text-lime-200" : ""}`}>{f.k}</div>
                  <div className="text-[12.5px] text-white/45">{f.sub}</div>
                </div>
              </div>
            ))}
            <p className="flex gap-2 pt-2 text-[13px] leading-relaxed text-white/45">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Rewards depend on trading volume and are reviewed before payment. They are never guaranteed.
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
                  <div className="label">Stepit · live</div>
                  <h3 className="mt-2 font-display text-3xl font-bold tracking-tight">The community today</h3>
                </div>
                <span className="flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-lime-300">
                  <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-neon" /> Live
                </span>
              </div>

              <div className="mt-8 flex flex-col items-center gap-8 sm:flex-row">
                <ProgressRing value={goalShare} size={176} stroke={13} id="rewards-ring">
                  <div>
                    <motion.div
                      initial={{ scale: 0 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 1.2, type: "spring", stiffness: 260, damping: 14 }}
                      className="font-display text-3xl font-bold tabular"
                    >
                      {Math.round(goalShare * 100)}%
                    </motion.div>
                    <div className="font-mono text-[9.5px] uppercase tracking-widest text-lime-300/80">reached the goal</div>
                  </div>
                </ProgressRing>

                <dl className="grid w-full flex-1 grid-cols-2 gap-3">
                  <Stat label="Steps today" value={fmtSteps(today.steps)} />
                  <Stat label="Walking today" value={today.walkers.toLocaleString("en-US")} />
                  <Stat label="Paid to walkers" value={`$${fmtAmount(data?.paid.total ?? 0)}`} accent />
                  <Stat label="Walkers joined" value={(data?.walkers ?? 0).toLocaleString("en-US")} />
                </dl>
              </div>

              <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center">
                <p className="flex items-center gap-2 text-[13px] text-white/60">
                  <Users className="h-4 w-4 shrink-0 text-lime-400" />
                  Daily goal: {fmtSteps(data?.dailyGoal ?? 10_000)} steps. Paid in <TokenIcon symbol={token} /> {token}.
                </p>
                <ButtonLink href="/steps" size="sm" icon={<Upload className="h-4 w-4" />}>
                  Upload your steps
                </ButtonLink>
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
