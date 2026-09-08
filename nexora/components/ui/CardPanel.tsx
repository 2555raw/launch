"use client";

import { useState } from "react";

const START = ["OpenAI", "AWS", "Vercel", "Datadog"];

/**
 * The card as an operator sees it: the credential, its ceiling, the merchants it
 * clears at, and the switch that stops it. The allowlist is editable so the
 * control reads as a control, not a picture of one.
 */
export function CardPanel() {
  const [merchants, setMerchants] = useState(START);
  const [draft, setDraft] = useState("");
  const [frozen, setFrozen] = useState(false);

  const add = () => {
    const name = draft.trim();
    if (!name || merchants.some((m) => m.toLowerCase() === name.toLowerCase())) return;
    setMerchants((m) => [...m, name]);
    setDraft("");
  };

  return (
    <div
      data-card-panel
      className="flex h-full flex-col overflow-hidden rounded-card border border-hairDark bg-[#0F0F0F] p-5 text-canvas md:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-[26px] font-extrabold tracking-[-0.03em] md:text-[30px]">
          Virtual Card
        </h3>
        <span
          data-card-state
          className={`inline-flex items-center gap-2 rounded-pill border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
            frozen ? "border-hairDark text-canvas/50" : "border-positive/40 text-positive"
          }`}
        >
          <i
            className={`h-1.5 w-1.5 rounded-full ${
              frozen ? "bg-canvas/40" : "bg-positive animate-pulseDot"
            }`}
          />
          {frozen ? "Frozen" : "Active"}
        </span>
      </div>

      {/* the card face */}
      <div className="relative mt-5 overflow-hidden rounded-card border border-hairDark bg-[#151515] p-5 md:p-6">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full border border-canvas/10"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full border border-canvas/[0.07]"
        />

        <div className="relative flex items-start justify-between gap-4">
          <p className="text-[17px] font-bold tracking-tight">Nexora</p>
          <span className="rounded-pill border border-hairDark px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-canvas/55">
            Agent issued
          </span>
        </div>

        <span
          aria-hidden
          className="relative mt-8 block h-6 w-9 rounded-[4px] border border-coral/50 bg-coral/20"
        />

        <p className="tnum relative mt-8 font-mono text-[19px] tracking-[0.12em] md:text-[22px]">
          5412 <span className="text-canvas/35">•••• ••••</span> 4417
        </p>

        <dl className="relative mt-6 flex items-end justify-between gap-6">
          <div>
            <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-canvas/45">
              Cardholder
            </dt>
            <dd className="mt-1.5 font-mono text-[13px]">procurement-agent</dd>
          </div>
          <div className="text-right">
            <dt className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-canvas/45">
              Limit
            </dt>
            <dd className="tnum mt-1.5 font-mono text-[13px]">$2,500 / mo</dd>
          </div>
        </dl>
      </div>

      {/* the allowlist, editable */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-canvas/45">
            Merchant allowlist
          </span>
          <span
            data-allow-count
            className="rounded-pill border border-hairDark px-2 py-0.5 font-mono text-[10px] text-canvas/55"
          >
            {merchants.length} allowed
          </span>
        </div>

        <ul data-allow-list className="mt-3 flex flex-wrap gap-2">
          {merchants.map((m) => (
            <li key={m}>
              <span className="inline-flex items-center gap-2 rounded-pill border border-hairDark bg-canvas/[0.04] py-1.5 pl-3.5 pr-2 font-mono text-[12px]">
                {m}
                <button
                  type="button"
                  onClick={() => setMerchants((list) => list.filter((x) => x !== m))}
                  aria-label={`Remove ${m}`}
                  className="flex h-4 w-4 items-center justify-center rounded-full border border-canvas/25 text-[10px] leading-none text-canvas/60 transition-colors duration-200 hover:border-coral hover:text-coral"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-card border border-hairDark p-2">
          <span className="flex overflow-hidden rounded-pill border border-hairDark" aria-hidden>
            <span className="bg-canvas/10 px-2.5 py-1 font-mono text-[11px]">Merchant</span>
            <span className="px-2.5 py-1 font-mono text-[11px] text-canvas/45">Category</span>
          </span>
          <label htmlFor="allow-add" className="sr-only">
            Add a merchant to the allowlist
          </label>
          <input
            id="allow-add"
            data-allow-input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="e.g. stripe.com"
            className="h-8 min-w-0 flex-1 bg-transparent px-2 font-mono text-[12px] text-canvas placeholder:text-canvas/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
          />
          <button
            type="button"
            data-allow-add
            onClick={add}
            className="h-8 shrink-0 rounded-pill bg-canvas px-3.5 font-mono text-[11.5px] text-ink transition-colors duration-200 hover:bg-coral hover:text-canvas"
          >
            + Add
          </button>
        </div>
      </div>

      {/* the switch */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-card border border-hairDark p-4">
        <div>
          <p className="flex items-center gap-2 text-[13.5px] font-medium">
            <i
              className={`h-1.5 w-1.5 rounded-full ${frozen ? "bg-coral" : "bg-positive"}`}
              aria-hidden
            />
            Card protection
          </p>
          <p data-freeze-copy className="mt-1 text-[12px] text-canvas/50">
            {frozen
              ? "Frozen. Every agent payment on this card is declined."
              : "Freeze instantly to block every agent payment."}
          </p>
        </div>
        <button
          type="button"
          data-freeze
          aria-pressed={frozen}
          onClick={() => setFrozen((v) => !v)}
          className={`h-9 shrink-0 rounded-pill px-4 text-[13px] font-medium transition-colors duration-200 ${
            frozen ? "bg-coral text-canvas" : "bg-canvas text-ink hover:bg-coral hover:text-canvas"
          }`}
        >
          {frozen ? "Unfreeze card" : "Freeze card"}
        </button>
      </div>
    </div>
  );
}
