"use client";

import { motion } from "framer-motion";
import { Coins, Footprints, Wallet } from "lucide-react";
import { Reveal, SectionHeading } from "./Reveal";

const STEPS = [
  {
    n: "01",
    stage: "Trailhead",
    title: "Connect Your Wallet",
    body: "Connect your crypto wallet securely.",
    detail: "MetaMask, WalletConnect, Coinbase and more. You sign one free message — no transaction, no approvals.",
    icon: Wallet,
    tag: "~30 seconds",
  },
  {
    n: "02",
    stage: "Ascent",
    title: "Track Your Steps",
    body: "Complete your daily walking goals and submit verified activity.",
    detail: "Sync from Apple Health or Google Health Connect. Only verified activity counts toward payouts.",
    icon: Footprints,
    tag: "Daily goal",
  },
  {
    n: "03",
    stage: "Summit",
    title: "Earn Rewards",
    body: "Receive your share of the $STEPIT trading fees.",
    detail: "A share of every token trade's fee is split by verified steps and sent to your wallet after review.",
    icon: Coins,
    tag: "Stablecoin payouts",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative scroll-mt-24 overflow-hidden py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-forest-600/20 blur-[120px]" />

      <div className="container relative">
        <SectionHeading index="01" label="How it works" title="From trailhead to payout" accent="in three steps.">
          No lock-ups, no staking, nothing to buy. Walk, sync your activity, and collect your share.
        </SectionHeading>

        <div className="relative mt-16 grid gap-5 md:grid-cols-3">
          {/* Dashed trail connecting the steps */}
          <svg className="pointer-events-none absolute left-0 right-0 top-[58px] hidden h-10 w-full md:block" preserveAspectRatio="none" viewBox="0 0 1000 40" aria-hidden>
            <motion.path
              d="M60 20 C 250 -10, 330 50, 500 20 S 760 -10, 940 20"
              fill="none"
              stroke="rgba(196,251,109,0.45)"
              strokeWidth="1.5"
              strokeDasharray="4 8"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2, ease: "easeInOut" }}
            />
          </svg>

          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12}>
              <div className="glass group relative h-full overflow-hidden rounded-3xl p-7 transition duration-500 hover:-translate-y-1.5 hover:border-lime-400/30 hover:bg-white/[0.07]">
                <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-lime-400/0 blur-3xl transition duration-700 group-hover:bg-lime-400/20" />
                <div className="flex items-center justify-between">
                  <div className="relative grid h-14 w-14 place-items-center rounded-2xl border border-lime-400/25 bg-forest-800/80 text-lime-300 shadow-[0_0_30px_-8px_rgba(178,240,71,0.6)] transition duration-500 group-hover:scale-110 group-hover:rotate-[-4deg]">
                    <s.icon className="h-6 w-6" />
                  </div>
                  <span className="font-display text-6xl font-bold text-white/[0.07] transition duration-500 group-hover:text-lime-400/20">{s.n}</span>
                </div>
                <div className="mt-8 font-mono text-[11px] uppercase tracking-[0.16em] text-lime-400">
                  {s.n} — {s.stage}
                </div>
                <h3 className="mt-1.5 font-display text-2xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-3 text-[15px] text-white/80">{s.body}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/50">{s.detail}</p>
                <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[10.5px] uppercase tracking-widest text-white/55">
                  {s.tag}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
