"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { getImageProps } from "next/image";
import { useRef } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { HeroStatsCard } from "./HeroStatsCard";
import { Ticker } from "./Ticker";

const LINES = [
  { text: "Your steps.", className: "text-white" },
  { text: "Your rewards.", className: "text-gradient-lime" },
  { text: "Your adventure.", className: "text-white" },
];

function HeroBackground() {
  // Art direction: a landscape crop for wide screens, a portrait crop centred on the hikers for phones.
  const common = { alt: "Two hikers walking a rocky trail towards snow-capped peaks", sizes: "100vw", quality: 80, priority: true };
  const {
    props: { srcSet: desktop },
  } = getImageProps({ ...common, src: "/images/hero-trail.jpg", width: 2560, height: 1708 });
  const {
    props: { srcSet: mobile, ...rest },
  } = getImageProps({ ...common, src: "/images/hero-trail-mobile.jpg", width: 1080, height: 1920 });
  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={desktop} />
      <source media="(max-width: 767px)" srcSet={mobile} />
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img {...rest} className="h-full w-full object-cover object-[70%_center] md:object-center" />
    </picture>
  );
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section id="home" ref={ref} className="grain relative isolate flex min-h-[100svh] flex-col overflow-hidden">
      {/* Photograph */}
      <motion.div
        className="absolute inset-0 -z-20"
        style={{ y: bgY }}
        initial={{ scale: 1.12 }}
        animate={{ scale: 1.02 }}
        transition={{ duration: 2.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <HeroBackground />
      </motion.div>

      {/* Legibility overlays: left-to-right shade, top and bottom fades, forest tint, vignette */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-950/85 via-ink-950/40 to-transparent" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink-950/55 via-transparent via-55% to-ink-950" />
      <div className="absolute inset-0 -z-10 bg-forest-900/15 mix-blend-multiply" />
      <div className="absolute inset-0 -z-10 [background:radial-gradient(120%_85%_at_65%_40%,transparent_45%,rgba(4,10,7,0.55)_100%)]" />

      {/* Survey markings */}
      <div className="pointer-events-none absolute inset-x-0 top-[92px] hidden px-6 md:block">
        <div className="mx-auto flex max-w-[1240px] items-center gap-4 font-mono text-[10.5px] tracking-[0.2em] text-white/45">
          <span>50.9423° S</span>
          <div className="ruler flex-1" />
          <span>ELEV 1,284 M</span>
          <div className="ruler flex-1" />
          <span>72.9701° W</span>
        </div>
      </div>

      <motion.div style={{ opacity: fade }} className="container relative flex flex-1 flex-col justify-center pb-28 pt-32 sm:pt-36 lg:pb-32">
        <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-black/30 py-1.5 pl-2 pr-4 backdrop-blur-md"
            >
              <span className="whitespace-nowrap rounded-full bg-lime-400 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-forest-950">
                Walk-to-earn
              </span>
              <span className="text-[13px] text-white/75">Rewards paid in stablecoins, on-chain</span>
            </motion.div>

            <h1 className="font-display text-[42px] font-bold uppercase leading-[0.92] tracking-[-0.03em] sm:text-6xl lg:text-[74px] xl:text-[84px]">
              {LINES.map((line, i) => (
                <span key={line.text} className="block overflow-hidden pb-1">
                  <motion.span
                    className={`block ${line.className}`}
                    initial={{ y: "105%", filter: "blur(8px)" }}
                    animate={{ y: "0%", filter: "blur(0px)" }}
                    transition={{ delay: 0.35 + i * 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {line.text}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.7 }}
              className="mt-7 max-w-xl text-[17px] leading-relaxed text-white/75 sm:text-lg"
            >
              Turn your daily steps into crypto rewards. Explore the outdoors, stay active and earn a share of platform
              fees.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.7 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <ConnectWallet size="lg" />
              <ButtonLink href="#how-it-works" variant="secondary" size="lg" icon={<ArrowDown className="h-4 w-4" />}>
                Discover How It Works
              </ButtonLink>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.25, duration: 0.8 }}
              className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-[13px] text-white/60"
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
            </motion.ul>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40, rotate: 2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ delay: 0.7, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-center lg:justify-end"
          >
            <HeroStatsCard />
          </motion.div>
        </div>
      </motion.div>

      <div className="absolute inset-x-0 bottom-0">
        <Ticker />
      </div>
    </section>
  );
}
