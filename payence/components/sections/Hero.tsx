"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "../ui/Button";
import { Label } from "../ui/Bits";
import { CountUp } from "../ui/CountUp";
import { AgentTerminal } from "../ui/AgentTerminal";
import { CardPanel } from "../ui/CardPanel";
import { SNAPSHOT } from "@/lib/snapshot";

const HEADLINE = ["Give", "AI", "Agents", "Their", "Own"];

export function Hero() {
  const still = useReducedMotion() || SNAPSHOT;

  const rise = (delay: number) =>
    still
      ? {}
      : {
          initial: { opacity: 0, y: 26 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: [0.22, 0.65, 0.3, 1] as const },
        };

  return (
    <section id="top" className="relative overflow-hidden pb-20 pt-14 md:pb-28 md:pt-20">
      <div className="shell">
        <motion.div {...rise(0.05)}>
          <Label>Financial infrastructure for autonomous agents</Label>
        </motion.div>

        {/* the headline arrives a word at a time, then the accent line lands */}
        <h1 className="mt-7 max-w-[16ch] text-display font-extrabold">
          {HEADLINE.map((word, i) => (
            <motion.span
              key={word}
              data-hero-word
              className="inline-block"
              initial={still ? false : { opacity: 0, y: "0.42em" }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.66, delay: 0.1 + i * 0.075, ease: [0.22, 0.65, 0.3, 1] }}
            >
              {word}&nbsp;
            </motion.span>
          ))}
          <motion.span
            data-hero-word
            className="inline-block text-coral"
            initial={still ? false : { opacity: 0, y: "0.42em" }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.72, delay: 0.5, ease: [0.22, 0.65, 0.3, 1] }}
          >
            Financial Layer.
          </motion.span>
        </h1>

        <motion.p
          className="mt-8 max-w-[54ch] text-[17px] leading-[1.6] text-muted md:text-[18px]"
          {...rise(0.62)}
        >
          Equip autonomous agents with controlled spending, virtual cards, payment policies and
          real-time transaction visibility from one platform.
        </motion.p>

        <motion.div className="mt-10 flex flex-wrap items-center gap-3" {...rise(0.7)}>
          <Button href="#get-started" size="lg">
            Get Started
          </Button>
          <Button href="#developers" size="lg" variant="outline">
            View Documentation
          </Button>
        </motion.div>

        {/* the product itself, opened up: the log on one side, the card on the other */}
        <motion.div
          className="mt-16 grid grid-cols-1 gap-4 rounded-card border border-hairDark bg-ink p-4 md:mt-20 md:grid-cols-2 md:gap-5 md:p-5"
          {...rise(0.78)}
        >
          <AgentTerminal />
          <CardPanel />
        </motion.div>

        <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-8 border-t border-hair pt-8 sm:grid-cols-3">
          <div>
            <dt className="text-[22px] font-bold tracking-tight">
              <CountUp to={41280} />
            </dt>
            <dd className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Agents funded
            </dd>
          </div>
          <div>
            <dt className="text-[22px] font-bold tracking-tight">
              <CountUp to={38} suffix=" ms" />
            </dt>
            <dd className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Authorization p50
            </dd>
          </div>
          <div>
            <dt className="tnum text-[22px] font-bold tracking-tight">0 →</dt>
            <dd className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Cards on shared keys
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
