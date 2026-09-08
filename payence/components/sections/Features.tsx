"use client";

import { motion } from "framer-motion";
import { Reveal } from "../ui/Reveal";
import { SNAPSHOT } from "@/lib/snapshot";
import { Label, Status } from "../ui/Bits";
import { Meter } from "../ui/Meter";

/** Each feature gets its own artwork, drawn from the thing it describes. */

function CardArt() {
  return (
    <div className="rounded-card border border-hairDark bg-ink p-5 text-canvas">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-canvas/50">
          Issued
        </span>
        <span className="font-mono text-[10.5px] text-canvas/70">0.8 s ago</span>
      </div>
      <p className="tnum mt-6 font-mono text-[17px]">
        <span className="text-canvas/40">•••• ••••</span> 4417
      </p>
      <p className="mt-5 font-mono text-[11.5px] text-canvas/70">procurement-agent</p>
    </div>
  );
}

function ControlArt() {
  return (
    <div className="rounded-card border border-hair bg-shell p-5">
      <div className="flex items-baseline justify-between">
        <span className="label">Budget</span>
        <span className="tnum font-mono text-[12px]">$1,609 / $4,000</span>
      </div>
      <Meter value={40} className="mt-3" />
      <ul className="mt-5 space-y-2.5">
        {[
          ["openai.com", true],
          ["aws.amazon.com", true],
          ["unknown-vendor.io", false],
        ].map(([m, ok]) => (
          <li key={m as string} className="flex items-center justify-between gap-3">
            <span className="font-mono text-[11.5px]">{m as string}</span>
            <span
              className={`font-mono text-[11px] ${ok ? "text-positive" : "text-coral line-through"}`}
            >
              {ok ? "allowed" : "denied"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SpendArt() {
  const bars = [34, 58, 41, 76, 52, 88, 63];
  return (
    <div className="rounded-card border border-hair bg-shell p-5">
      <div className="flex items-baseline justify-between">
        <span className="label">Spend · 7d</span>
        <span className="tnum font-mono text-[12px] text-coral">+12%</span>
      </div>
      <div className="mt-6 flex h-24 items-end gap-2" aria-hidden>
        {bars.map((h, i) => (
          <motion.span
            key={i}
            data-spend-bar={h}
            className={`flex-1 rounded-[3px] ${i === bars.length - 2 ? "bg-coral" : "bg-ink/15"}`}
            style={{ height: `${h}%` }}
            initial={SNAPSHOT ? false : { height: 0 }}
            whileInView={{ height: `${h}%` }}
            viewport={{ once: true, margin: "0px 0px -12% 0px" }}
            transition={{ duration: 0.7, delay: i * 0.07, ease: [0.22, 0.65, 0.3, 1] }}
          />
        ))}
      </div>
      <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
        <span>Mon</span>
        <span>Sun</span>
      </div>
    </div>
  );
}

function AuditArt() {
  return (
    <div className="rounded-card border border-hair bg-shell p-5">
      <span className="label">Audit trail</span>
      <ol className="mt-4 space-y-4">
        {[
          ["task", "Renew API quota"],
          ["policy", "pol_procure_2500"],
          ["approval", "auto · under threshold"],
          ["settled", "$20.00 · openai.com"],
        ].map(([k, v], i, arr) => (
          <li key={k} className="relative flex gap-3.5 pl-1">
            <span className="relative flex flex-col items-center">
              <i className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
              {i < arr.length - 1 && <i className="mt-1 w-px flex-1 bg-hair" />}
            </span>
            <span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {k}
              </span>
              <span className="mt-1 block font-mono text-[12px]">{v}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

const FEATURES = [
  {
    n: "01",
    title: "Instant Card Issuance",
    body: "Create and fund virtual cards for AI agents instantly.",
    art: <CardArt />,
  },
  {
    n: "02",
    title: "Network Enforced Controls",
    body: "Restrict merchants, control budgets and enforce spending boundaries.",
    art: <ControlArt />,
  },
  {
    n: "03",
    title: "Real-Time Agent Spend",
    body: "Monitor every transaction across agents and virtual cards.",
    art: <SpendArt />,
  },
  {
    n: "04",
    title: "Audit Logs",
    body: "Track every transaction back to the agent, task, policy and approval.",
    art: <AuditArt />,
  },
];

export function Features() {
  return (
    <section id="platform" className="border-t border-hair py-24 md:py-32">
      <div className="shell">
        <Reveal>
          <Label>Capabilities</Label>
          <h2 className="mt-6 max-w-[20ch] text-title font-extrabold">
            Four things a card for a machine has to do.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {FEATURES.map((f, i) => (
            <Reveal key={f.n} delay={i * 0.06} as="article" className="h-full">
              <div className="card card-hover flex h-full flex-col p-6 md:p-8">
                <div className="flex items-baseline gap-4">
                  <span className="tnum font-mono text-[12px] text-coral">{f.n}</span>
                  <h3 className="text-[21px] font-bold tracking-tight">{f.title}</h3>
                </div>
                <p className="mt-3 max-w-[42ch] text-[14.5px] leading-relaxed text-muted">
                  {f.body}
                </p>
                <div className="mt-8">{f.art}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export { Status };
