"use client";

import { useEffect, useState } from "react";
import { Reveal } from "../ui/Reveal";
import { Label, Status } from "../ui/Bits";
import { Meter } from "../ui/Meter";
import { Button } from "../ui/Button";

const RUNS = [
  { task: "Renew API quota", merchant: "openai.com", amount: 20, state: "approved" as const },
  { task: "Provision test cluster", merchant: "aws.amazon.com", amount: 48, state: "approved" as const },
  { task: "Buy vendor dataset", merchant: "unknown-vendor.io", amount: 310, state: "blocked" as const },
];

export function Showcase() {
  const [i, setI] = useState(0);
  const [frozen, setFrozen] = useState(false);

  // The console cycles through the runs it is reporting. It is the same three
  // rows every time — the movement shows state changing, not fake volume.
  useEffect(() => {
    if (frozen) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % RUNS.length), 3200);
    return () => window.clearInterval(id);
  }, [frozen]);

  const run = RUNS[i];
  const spent = 1_609;
  const cap = 4_000;

  return (
    <section className="border-t border-hair bg-shell py-24 md:py-32">
      <div className="shell">
        <Reveal>
          <Label>Product</Label>
          <h2 className="mt-6 max-w-[18ch] text-title font-extrabold">
            One console for every card your fleet carries.
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-14 overflow-hidden rounded-card border border-hairStrong bg-canvas">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hair px-5 py-4 md:px-7">
              <div className="flex items-center gap-3">
                <span className="text-[15px] font-bold tracking-tight">NEXORA</span>
                <span className="font-mono text-[12px] text-muted">— agent activity</span>
              </div>
              <div className="flex items-center gap-3">
                <Status tone={frozen ? "blocked" : "live"} pulse={!frozen}>
                  {frozen ? "Frozen" : "Live"}
                </Status>
                <Button size="sm" variant="outline" onClick={() => setFrozen((v) => !v)}>
                  {frozen ? "Unfreeze card" : "Freeze card"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y divide-hair lg:grid-cols-[minmax(0,1fr)_320px] lg:divide-x lg:divide-y-0">
              <div className="p-5 md:p-7">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
                  <div>
                    <dt className="label">Agent</dt>
                    <dd className="mt-2 font-mono text-[13.5px]">procurement-agent</dd>
                  </div>
                  <div>
                    <dt className="label">Virtual card</dt>
                    <dd className="mt-2 tnum font-mono text-[13.5px]">•••• 4417</dd>
                  </div>
                  <div>
                    <dt className="label">Task</dt>
                    <dd className="mt-2 font-mono text-[13.5px]">{run.task}</dd>
                  </div>
                </dl>

                <div className="mt-8 border-t border-hair pt-6">
                  <div className="flex items-baseline justify-between">
                    <span className="label">Spending limit</span>
                    <span className="tnum font-mono text-[13px]">
                      ${spent.toLocaleString("en-US")} / ${cap.toLocaleString("en-US")}
                    </span>
                  </div>
                  <Meter value={(spent / cap) * 100} className="mt-3" />
                </div>

                <div className="mt-8 border-t border-hair pt-6">
                  <span className="label">Merchant allowlist</span>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {["openai.com", "aws.amazon.com", "vercel.com", "datadoghq.com"].map((m) => (
                      <li
                        key={m}
                        className="rounded-pill border border-hair px-3 py-1.5 font-mono text-[11.5px]"
                      >
                        {m}
                      </li>
                    ))}
                    <li className="rounded-pill border border-hair px-3 py-1.5 font-mono text-[11.5px] text-muted line-through">
                      everything else
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-5 md:p-7">
                <span className="label">Transaction status</span>
                <div className="mt-4 space-y-3">
                  {RUNS.map((r, idx) => (
                    <div
                      key={r.merchant}
                      className={`rounded-card border p-4 transition-colors duration-500 ${
                        idx === i && !frozen ? "border-hairStrong bg-shell" : "border-hair"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate font-mono text-[12.5px]">{r.merchant}</p>
                        <p className="tnum font-mono text-[12.5px]">${r.amount}.00</p>
                      </div>
                      <div className="mt-3">
                        <Status tone={frozen ? "idle" : r.state}>
                          {frozen ? "Held" : r.state === "blocked" ? "Blocked" : "Approved"}
                        </Status>
                      </div>
                      {r.state === "blocked" && !frozen && (
                        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">
                          merchant not in allowlist → declined at the network
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
