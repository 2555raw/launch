"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Reveal } from "../ui/Reveal";
import { Label, Status } from "../ui/Bits";
import { Meter } from "../ui/Meter";

type Panel = {
  key: string;
  tab: string;
  title: string;
  body: string;
  render: () => JSX.Element;
};

const check = (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden>
    <path
      d="M3.5 8.5l3 3 6-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PANELS: Panel[] = [
  {
    key: "cards",
    tab: "Cards",
    title: "Instant Card Issuance",
    body: "A card exists the moment the agent does, funded from the balance you already keep.",
    render: () => (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["procurement-agent", "•••• 4417", "active"],
          ["research-agent", "•••• 8820", "active"],
          ["ops-agent", "•••• 1093", "frozen"],
        ].map(([who, pan, state]) => (
          <div key={pan} className="rounded-card border border-hair bg-canvas p-4">
            <p className="truncate font-mono text-[12px]">{who}</p>
            <p className="tnum mt-3 font-mono text-[14px]">{pan}</p>
            <div className="mt-4">
              <Status tone={state === "active" ? "approved" : "idle"}>{state}</Status>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "limits",
    tab: "Limits",
    title: "Per-Agent Limits",
    body: "Every agent carries its own ceiling. Nothing is pooled, so nothing drains the fleet.",
    render: () => (
      <div className="space-y-5">
        {[
          ["procurement-agent", 40, "$1,609 / $4,000"],
          ["research-agent", 72, "$1,080 / $1,500"],
          ["billing-agent", 18, "$180 / $1,000"],
        ].map(([who, pct, amount], i) => (
          <div key={who as string}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-[12.5px]">{who as string}</span>
              <span className="tnum font-mono text-[12px] text-muted">{amount as string}</span>
            </div>
            <Meter
              value={pct as number}
              tone={(pct as number) > 70 ? "coral" : "ink"}
              delay={i * 0.08}
              className="mt-2.5"
            />
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "security",
    tab: "Security",
    title: "Merchant Locks",
    body: "The allowlist is enforced at the network, not inside the prompt, so a jailbreak buys nothing.",
    render: () => (
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          ["openai.com", true],
          ["aws.amazon.com", true],
          ["vercel.com", true],
          ["unknown-vendor.io", false],
        ].map(([m, ok]) => (
          <li
            key={m as string}
            className="flex items-center justify-between gap-3 rounded-card border border-hair bg-canvas px-4 py-3.5"
          >
            <span className="truncate font-mono text-[12.5px]">{m as string}</span>
            <span className={(ok as boolean) ? "text-positive" : "text-coral"}>
              {(ok as boolean) ? check : <span className="font-mono text-[11px]">denied</span>}
            </span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    key: "webhooks",
    tab: "Webhooks",
    title: "Real-Time Webhooks",
    body: "Signed events land as the authorization happens, not on tomorrow's statement.",
    render: () => (
      <ul className="divide-y divide-hair overflow-hidden rounded-card border border-hair bg-canvas">
        {[
          ["card.authorized", "200", "12:04:21"],
          ["card.declined", "200", "12:03:52"],
          ["policy.threshold_hit", "200", "11:58:04"],
        ].map(([evt, code, t]) => (
          <li key={evt} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <span className="truncate font-mono text-[12.5px]">{evt}</span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="tnum font-mono text-[11px] text-muted">{t}</span>
              <span className="rounded-pill border border-positive/30 px-2 py-0.5 font-mono text-[10.5px] text-positive">
                {code}
              </span>
            </span>
          </li>
        ))}
      </ul>
    ),
  },
  {
    key: "mcp",
    tab: "MCP",
    title: "MCP Server",
    body: "Add one server and the agent sees paying as a tool, with the policy already wrapped around it.",
    render: () => (
      <div className="overflow-hidden rounded-card border border-hairDark bg-ink p-5 text-canvas">
        <pre className="overflow-x-auto font-mono text-[12.5px] leading-[1.8]">
          <code>
            <span className="block text-canvas/45">// tools published to the agent</span>
            <span className="block">
              <span className="text-violet">issue_card</span>
              <span className="text-canvas/60">(agent, limit, merchant)</span>
            </span>
            <span className="block">
              <span className="text-violet">check_balance</span>
              <span className="text-canvas/60">()</span>
            </span>
            <span className="block">
              <span className="text-violet">freeze_card</span>
              <span className="text-canvas/60">(card_id)</span>
            </span>
          </code>
        </pre>
      </div>
    ),
  },
];

export function Infrastructure() {
  const [active, setActive] = useState(PANELS[0].key);
  const still = useReducedMotion();
  const panel = PANELS.find((p) => p.key === active)!;

  return (
    <section id="security" className="border-t border-hair bg-shell py-24 md:py-32">
      <div className="shell">
        <Reveal>
          <Label>Platform</Label>
          <h2 className="mt-6 max-w-[19ch] text-title font-extrabold">
            Payment Infrastructure Built For Agents
          </h2>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-12 overflow-x-auto">
            <div
              role="tablist"
              aria-label="Platform capabilities"
              className="inline-flex min-w-full gap-1 border-b border-hair pb-px"
            >
              {PANELS.map((p) => (
                <button
                  key={p.key}
                  role="tab"
                  id={`tab-${p.key}`}
                  aria-selected={active === p.key}
                  aria-controls={`panel-${p.key}`}
                  onClick={() => setActive(p.key)}
                  className={`relative whitespace-nowrap px-5 py-3.5 text-[14px] transition-colors duration-200 ${
                    active === p.key ? "text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {p.tab}
                  {active === p.key && (
                    <motion.span
                      layoutId="tab-underline"
                      className="absolute inset-x-3 -bottom-px h-[2px] bg-coral"
                      transition={{ duration: still ? 0 : 0.32, ease: [0.22, 0.65, 0.3, 1] }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={panel.key}
              role="tabpanel"
              id={`panel-${panel.key}`}
              aria-labelledby={`tab-${panel.key}`}
              initial={still ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={still ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 0.65, 0.3, 1] }}
              className="grid grid-cols-1 gap-10 rounded-card border border-hair bg-canvas p-6 md:grid-cols-[0.8fr_1.2fr] md:gap-14 md:p-10"
            >
              <div>
                <h3 className="text-[24px] font-bold tracking-tight md:text-[28px]">
                  {panel.title}
                </h3>
                <p className="mt-4 max-w-[38ch] text-[15px] leading-relaxed text-muted">
                  {panel.body}
                </p>
              </div>
              <div>{panel.render()}</div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
