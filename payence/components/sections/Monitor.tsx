"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "../ui/Reveal";
import { Label, Status } from "../ui/Bits";
import { Meter } from "../ui/Meter";

const LINES = [
  { merchant: "OpenAI API", amount: 20, agent: "procurement-agent", t: "12:04:21" },
  { merchant: "AWS", amount: 48, agent: "research-agent", t: "11:52:09" },
  { merchant: "Vercel", amount: 29, agent: "billing-agent", t: "11:31:44" },
  { merchant: "Datadog", amount: 12, agent: "ops-agent", t: "10:58:17" },
];

const SPARK = [22, 41, 33, 58, 47, 71, 62, 88, 74, 96, 83, 92];

export function Monitor() {
  const [remaining, setRemaining] = useState(2391);
  const still = useReducedMotion();

  // The remaining balance ticks down the way a live figure would, in small
  // authorization-sized steps, and stops well before it could read as empty.
  useEffect(() => {
    if (still) return;
    const id = window.setInterval(() => {
      setRemaining((v) => (v <= 2280 ? 2391 : v - Math.floor(Math.random() * 9 + 2)));
    }, 2600);
    return () => window.clearInterval(id);
  }, [still]);

  const spent = LINES.reduce((a, l) => a + l.amount, 0);

  return (
    <section className="border-t border-hair bg-shell py-24 md:py-32">
      <div className="shell">
        <Reveal>
          <Label>Spending monitor</Label>
          <h2 className="mt-6 max-w-[20ch] text-title font-extrabold">
            Every charge, the second it clears.
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <Reveal>
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between gap-4 border-b border-hair px-5 py-4 md:px-6">
                <p className="font-mono text-[12.5px]">transactions · today</p>
                <Status tone="live" pulse>
                  Live
                </Status>
              </div>
              <ul className="divide-y divide-hair">
                {LINES.map((l) => (
                  <li
                    key={l.merchant}
                    className="flex items-center justify-between gap-4 px-5 py-5 transition-colors duration-200 hover:bg-shell md:px-6"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium">{l.merchant}</p>
                      <p className="mt-1.5 truncate font-mono text-[11.5px] text-muted">
                        {l.agent} · {l.t}
                      </p>
                    </div>
                    <p className="tnum shrink-0 font-mono text-[15px]">-${l.amount}</p>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-4 border-t border-hair px-5 py-4 md:px-6">
                <span className="label">Settled today</span>
                <span className="tnum font-mono text-[13px]">${spent}.00</span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="card flex h-full flex-col p-6 md:p-7">
              <Label>Remaining budget</Label>
              <motion.p
                key={remaining}
                initial={still ? false : { opacity: 0.55, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45 }}
                className="tnum mt-4 text-[44px] font-extrabold leading-none tracking-[-0.04em] md:text-[52px]"
              >
                ${remaining.toLocaleString("en-US")}
              </motion.p>
              <p className="mt-3 font-mono text-[11.5px] text-muted">of $2,500 monthly cap</p>

              <Meter value={(remaining / 2500) * 100} tone="positive" className="mt-6" />

              <div className="mt-9 border-t border-hair pt-6">
                <div className="flex items-baseline justify-between">
                  <span className="label">Burn · 12h</span>
                  <span className="font-mono text-[11.5px] text-muted">steady</span>
                </div>
                <div className="mt-4 flex h-16 items-end gap-1.5" aria-hidden>
                  {SPARK.map((h, i) => (
                    <span
                      key={i}
                      className={`flex-1 rounded-[2px] ${
                        i === SPARK.length - 1 ? "bg-coral" : "bg-ink/15"
                      }`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>

              <p className="mt-auto pt-8 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
                Sample figures
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
