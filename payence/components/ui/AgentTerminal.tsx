"use client";

import { useEffect, useState } from "react";
import { SNAPSHOT } from "@/lib/snapshot";

type Tone = "agent" | "payence" | "card" | "ok" | "audit" | "deny";

const LINES: { tag: Tone; text: string }[] = [
  { tag: "agent", text: "procurement-agent → authorization requested" },
  { tag: "agent", text: "payee api.openai.com · amount $20.00" },
  { tag: "payence", text: "per-call ceiling ............... within limit" },
  { tag: "payence", text: "merchant allowlist ............. match" },
  { tag: "payence", text: "monthly budget ................. $2,411 left" },
  { tag: "card", text: "virtual card •••• 4417 authorized in 31 ms" },
  { tag: "ok", text: "captured $20.00 · openai.com" },
  { tag: "audit", text: "auth_3b71de written to the ledger" },
  { tag: "agent", text: "payee aws.amazon.com · amount $48.00" },
  { tag: "payence", text: "all policy checks .............. pass" },
  { tag: "ok", text: "captured $48.00 · aws.amazon.com" },
  { tag: "agent", text: "payee unknown-vendor.io · amount $99.00" },
  { tag: "payence", text: "merchant allowlist ............. no match" },
  { tag: "deny", text: "declined at the network · pol_procure_2500" },
];

const TONE: Record<Tone, string> = {
  agent: "text-canvas/45",
  payence: "text-violet",
  card: "text-canvas/70",
  ok: "text-positive",
  audit: "text-canvas/45",
  deny: "text-coral",
};

/**
 * The authorization log, written out line by line the way it would arrive.
 * It runs once when it reaches the viewport and then holds the full log — it is
 * a record of what happened, not a loop.
 */
export function AgentTerminal() {
  // The snapshot ships the complete log so the flat page reads at rest; in the
  // app it starts empty and fills in.
  const [shown, setShown] = useState(SNAPSHOT ? LINES.length : 0);
  const [started, setStarted] = useState(SNAPSHOT);

  useEffect(() => {
    if (started) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(LINES.length);
      setStarted(true);
      return;
    }
    const el = document.getElementById("agent-terminal");
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started || shown >= LINES.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 260 : 220);
    return () => window.clearTimeout(t);
  }, [started, shown]);

  const done = shown >= LINES.length;

  return (
    <div
      id="agent-terminal"
      className="flex h-full flex-col overflow-hidden rounded-card border border-hairDark bg-[#0F0F0F]"
    >
      <div className="flex items-center gap-3 border-b border-hairDark px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <i key={i} className="h-2 w-2 rounded-full bg-canvas/20" />
          ))}
        </span>
        <span className="flex-1 text-center font-mono text-[11px] text-canvas/45">
          payence — agent activity
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-coral">
          <i className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-coral align-middle animate-pulseDot" />
          live
        </span>
      </div>

      <div className="grow overflow-x-auto p-4 md:p-5">
        <pre className="font-mono text-[11.5px] leading-[1.95] md:text-[12.5px]">
          <code>
            {LINES.map((l, i) => (
              <span
                key={i}
                data-term-line
                hidden={i >= shown}
                className="block whitespace-pre text-canvas/85"
              >
                <span className={`${TONE[l.tag]} inline-block w-[76px]`}>[{l.tag}]</span>
                {l.text}
              </span>
            ))}
            <span
              data-term-caret
              hidden={done}
              className="inline-block h-3.5 w-[7px] translate-y-[2px] bg-coral"
              aria-hidden
            />
          </code>
        </pre>
      </div>

      <p className="border-t border-hairDark px-4 py-3 font-mono text-[10.5px] text-canvas/40">
        Every request checked against policy. Every charge written to the ledger.
      </p>
    </div>
  );
}
