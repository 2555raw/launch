"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Button } from "../ui/Button";
import { Label, Status } from "../ui/Bits";
import { VirtualCard } from "../ui/VirtualCard";

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const still = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // Very light parallax: the card panel drifts a few pixels slower than the type.
  const drift = useTransform(scrollYProgress, [0, 1], [0, still ? 0 : -46]);

  const rise = (delay: number) =>
    still
      ? {}
      : {
          initial: { opacity: 0, y: 26 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: [0.22, 0.65, 0.3, 1] as const },
        };

  return (
    <section ref={ref} id="top" className="relative overflow-hidden pb-20 pt-16 md:pb-32 md:pt-24">
      <div className="shell">
        <motion.div {...rise(0.05)}>
          <div className="flex flex-wrap items-center gap-3">
            <Status tone="live" pulse>
              Issuing live
            </Status>
            <Label>Financial infrastructure for autonomous agents</Label>
          </div>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <motion.h1 className="text-display font-extrabold" {...rise(0.12)}>
              Give AI Agents
              <br />
              Their Own
              <br />
              <span className="text-coral">Financial Layer.</span>
            </motion.h1>

            <motion.p
              className="mt-8 max-w-[46ch] text-[17px] leading-[1.6] text-muted md:text-[18px]"
              {...rise(0.2)}
            >
              Equip autonomous agents with controlled spending, virtual cards, payment policies and
              real-time transaction visibility from one platform.
            </motion.p>

            <motion.div className="mt-10 flex flex-wrap items-center gap-3" {...rise(0.28)}>
              <Button href="#get-started" size="lg">
                Get Started
              </Button>
              <Button href="#developers" size="lg" variant="outline">
                View Documentation
              </Button>
            </motion.div>

            <motion.dl
              className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-hair pt-7"
              {...rise(0.36)}
            >
              {[
                ["41,280", "Agents funded"],
                ["38 ms", "Authorization p50"],
                ["0 →", "Cards on shared keys"],
              ].map(([v, k]) => (
                <div key={k}>
                  <dt className="tnum text-[22px] font-bold tracking-tight">{v}</dt>
                  <dd className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {k}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </div>

          <motion.div style={{ y: drift }} className="relative" {...rise(0.22)}>
            <div className="relative">
              <VirtualCard />

              {/* two interface chips docked to the card, the way the console shows them */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="card p-4">
                  <Label>Policy</Label>
                  <p className="mt-2.5 font-mono text-[13px]">pol_procure_2500</p>
                  <p className="mt-1 text-[12px] text-muted">Merchant lock · 2 allowed</p>
                </div>
                <div className="card p-4">
                  <Label>Last auth</Label>
                  <p className="mt-2.5 tnum font-mono text-[13px]">$20.00 · openai.com</p>
                  <div className="mt-2">
                    <Status tone="approved">Approved</Status>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
