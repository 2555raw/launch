"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { TokenIcon } from "@/components/ui/TokenIcon";
import { XLogo } from "@/components/ui/XLogo";
import { fmtSteps } from "@/lib/format";
import { X_HANDLE, X_URL } from "@/lib/social";
import { ContractAddress } from "./ContractAddress";
import { usePublicStats } from "./usePublicStats";

/** Below this many walkers the hero shows what you can earn rather than community totals. */
const LIVE_FROM_WALKERS = 25;

function HeroBackground() {
  // Art direction: a landscape crop for wide screens, a portrait crop centred on the walker for phones.
  // The WebP files are pre-sized, so the server never has to resize images on the fly.
  return (
    <picture>
      <source media="(min-width: 768px)" srcSet="/images/forest-river-1280.webp 1280w, /images/forest-river.webp 2400w" sizes="100vw" />
      <source media="(max-width: 767px)" srcSet="/images/forest-river-mobile.webp" />
      <img
        src="/images/forest-river.webp"
        alt="A walker standing on the rocks of a river running through a misty pine forest"
        fetchPriority="high"
        decoding="async"
        className="h-full w-full object-cover object-[50%_70%]"
      />
    </picture>
  );
}

/** Time left until the UTC day closes, refreshed every second. */
function useDayCountdown() {
  const [left, setLeft] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
      const s = Math.max(0, Math.floor((end - now.getTime()) / 1000));
      const p = (n: number) => String(n).padStart(2, "0");
      setLeft(`${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return left;
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const { data: stats } = usePublicStats();
  const countdown = useDayCountdown();
  const max = stats?.maxDaily ? `$${Number.isInteger(stats.maxDaily) ? stats.maxDaily : stats.maxDaily.toFixed(2)}` : "$5";
  const maxSteps = stats?.maxDailySteps ? fmtSteps(stats.maxDailySteps) : "10,000";

  // Until the community is big enough for live totals to mean something, the strip shows what a walker can
  // earn instead of a row of zeros. It switches to the live figures on its own once real activity comes in.
  const live = Boolean(stats && (stats.walkers >= LIVE_FROM_WALKERS || stats.paid.total > 0));
  const strip = live
    ? [
        { label: "Walkers", value: stats!.walkers.toLocaleString("en-US") },
        { label: "Steps today", value: fmtSteps(stats!.today.steps) },
        { label: "Paid to walkers", value: `$${stats!.paid.total.toFixed(2)}` },
        { label: "Today closes in", value: countdown ?? "·" },
      ]
    : [
        { label: "Earn up to", value: `${max} a day` },
        { label: "Max from", value: `${maxSteps} steps` },
        { label: "Weekly prize", value: "$50" },
        { label: "Today closes in", value: countdown ?? "·" },
      ];

  return (
    <section id="home" ref={ref} className="grain relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      {/* Photograph */}
      <motion.div
        className="absolute inset-0 -z-20"
        style={{ y: bgY }}
        initial={{ scale: 1.1 }}
        animate={{ scale: 1.02 }}
        transition={{ duration: 2.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <HeroBackground />
      </motion.div>

      {/* Legibility overlays: a cool night tint, a centred shade behind the text and a fade into the page */}
      <div className="absolute inset-0 -z-10 bg-forest-950/20" />
      <div className="absolute inset-0 -z-10 [background:radial-gradient(70%_60%_at_50%_42%,rgba(5,7,11,0.6)_0%,rgba(5,7,11,0.15)_70%,transparent_100%)]" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink-950/50 via-transparent via-55% to-ink-950" />

      <motion.div style={{ opacity: fade }} className="container relative flex flex-1 flex-col items-center justify-center pb-10 pt-32 text-center sm:pt-36">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-black/35 py-1.5 pl-2 pr-4 backdrop-blur-md"
        >
          <span className="whitespace-nowrap rounded-full bg-lime-400 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-950">
            Walk to earn
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-white/75">
            Up to <span className="font-mono font-semibold text-lime-300">{max}</span> a day · paid in
            <TokenIcon symbol="ETH" className="h-3.5 w-3.5" /> ETH
          </span>
        </motion.div>

        <h1 className="max-w-4xl font-display text-[46px] font-bold leading-[0.95] tracking-[-0.035em] sm:text-7xl lg:text-[96px]">
          {["Every stride", "pays you back."].map((line, i) => (
            <span key={line} className="block overflow-hidden pb-2">
              <motion.span
                className={`block ${i === 1 ? "text-gradient-lime" : "text-white"}`}
                initial={{ y: "105%", filter: "blur(8px)" }}
                animate={{ y: "0%", filter: "blur(0px)" }}
                transition={{ delay: 0.35 + i * 0.14, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.7 }}
          className="mt-7 max-w-2xl text-[17px] leading-relaxed text-white/75 sm:text-lg"
        >
          Upload a screenshot of your daily steps and earn up to <span className="font-semibold text-lime-300">{max} a day</span>,
          paid in ETH to your wallet on Robinhood Chain. The more you walk, the more you earn, up to {maxSteps} steps.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, duration: 0.7 }}
          className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
        >
          <ConnectWallet size="lg" />
          <ButtonLink href="#how-it-works" variant="secondary" size="lg" icon={<ArrowDown className="h-4 w-4" />}>
            See how it works
          </ButtonLink>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="mt-5 text-[13.5px] text-white/60"
        >
          Free to join. Nothing to buy, nothing to hold.
        </motion.p>
        <ContractAddress className="mx-auto mt-5" />

        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-[13px] text-white/60"
        >
          <li className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-lime-400" /> Never asks for your seed phrase
          </li>
          <li className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-lime-400" /> No token approvals
          </li>
          <li className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-lime-400" /> Verified activity only
          </li>
          <li>
            <a href={X_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 transition hover:text-lime-300">
              <XLogo className="h-3.5 w-3.5 text-white" /> @{X_HANDLE}
            </a>
          </li>
        </motion.ul>
      </motion.div>

      {/* Live figures along the bottom edge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3, duration: 0.8 }}
        className="container relative pb-8"
      >
        <dl className="grid grid-cols-2 overflow-hidden rounded-3xl border border-white/10 bg-ink-950/60 backdrop-blur-xl lg:grid-cols-4">
          {strip.map((s, i) => (
            <div
              key={s.label}
              className={`px-5 py-4 text-left sm:px-7 sm:py-5 ${i % 2 === 1 ? "border-l border-white/10" : ""} ${i > 1 ? "border-t border-white/10 lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}
            >
              <dt className="label !text-[10px]">{s.label}</dt>
              <dd className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white sm:text-2xl">{s.value}</dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </section>
  );
}
