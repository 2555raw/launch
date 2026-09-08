"use client";

import { useEffect, useRef, useState } from "react";
import { NETWORKS, type Network } from "./CardNetworks";

const START = ["OpenAI", "AWS", "Vercel", "Datadog"];

/**
 * The colours the card face can take. Each is a token already on the page, so
 * every choice stays inside the identity, and each carries the ink that reads
 * against it. The face is driven by two custom properties rather than swapped
 * class lists, which keeps the whole card one variable away from re-colouring.
 */
export const CARD_THEMES = [
  { id: "ink", name: "Ink", face: "#151515", ink: "#F4F1EA" },
  { id: "coral", name: "Coral", face: "#FF5C35", ink: "#1A0B06" },
  { id: "violet", name: "Violet", face: "#6C63FF", ink: "#F4F1EA" },
  { id: "green", name: "Green", face: "#28A96B", ink: "#04180F" },
  { id: "cream", name: "Cream", face: "#E8E3D8", ink: "#151515" },
] as const;

export function CardPanel() {
  const [merchants, setMerchants] = useState<string[]>([...START]);
  const [draft, setDraft] = useState("");
  const [frozen, setFrozen] = useState(false);
  const [holder, setHolder] = useState("procurement-agent");
  const [theme, setTheme] = useState<(typeof CARD_THEMES)[number]>(CARD_THEMES[0]);
  const [network, setNetwork] = useState<Network>(NETWORKS[0]);

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

      {/* the card face — an example you can put your own name on */}
      <div
        data-card-face
        style={
          { "--face": theme.face, "--ink": theme.ink } as React.CSSProperties
        }
        className="relative mt-5 overflow-hidden rounded-card bg-[var(--face)] p-5 text-[var(--ink)] transition-colors duration-500 md:p-6"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full border border-current opacity-10"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full border border-current opacity-[0.07]"
        />

        <div className="relative flex items-start justify-between gap-4">
          <p className="text-[17px] font-bold tracking-tight">Payence</p>
          <span className="rounded-pill border border-current px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] opacity-55">
            Agent issued
          </span>
        </div>

        <CardChip />

        <p className="tnum relative mt-8 font-mono text-[19px] tracking-[0.12em] md:text-[22px]">
          5412 <span className="opacity-35">•••• ••••</span> 4417
        </p>

        <div className="relative mt-6 flex items-end justify-between gap-6">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="card-holder"
              className="block font-mono text-[9.5px] uppercase tracking-[0.16em] opacity-55"
            >
              Cardholder
            </label>
            <input
              id="card-holder"
              data-card-name
              value={holder}
              maxLength={24}
              onChange={(e) => setHolder(e.target.value)}
              placeholder="your name here"
              aria-label="Cardholder name — type your own"
              className="mt-1 w-full min-w-0 border-b border-current/0 bg-transparent pb-0.5 font-mono text-[13px] text-[var(--ink)] transition-colors duration-200 placeholder:opacity-40 hover:border-current/40 focus:border-current focus:outline-none focus-visible:outline-none"
            />
          </div>
          <div className="shrink-0 text-right">
            <span className="block font-mono text-[9.5px] uppercase tracking-[0.16em] opacity-55">
              Limit
            </span>
            <span className="tnum mt-1 block font-mono text-[13px]">$2,500 / mo</span>
          </div>

          {/* the network the card is issued on, where a scheme mark sits */}
          <div data-card-network className="shrink-0 text-right">
            <network.Mark />
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.16em] opacity-60">
              {network.name}
            </span>
          </div>
        </div>
      </div>

      {/* the network, chosen one at a time */}
      <NetworkPicker value={network} onChange={setNetwork} />

      {/* the palette */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairDark px-4 py-3">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-canvas/45">
          Card colour
        </span>
        <div className="flex items-center gap-2" role="group" aria-label="Card colour">
          {CARD_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              data-card-theme={t.id}
              data-face={t.face}
              data-ink={t.ink}
              onClick={() => setTheme(t)}
              aria-pressed={theme.id === t.id}
              aria-label={`${t.name} card`}
              title={t.name}
              style={{ backgroundColor: t.face }}
              className={`h-6 w-6 rounded-full border transition-transform duration-200 hover:scale-110 ${
                theme.id === t.id
                  ? "border-canvas ring-2 ring-canvas/70 ring-offset-2 ring-offset-[#0F0F0F]"
                  : "border-canvas/25"
              }`}
            />
          ))}
        </div>
      </div>

      <p className="mt-2.5 font-mono text-[10.5px] leading-relaxed text-canvas/40">
        Example card — type your own name on it, pick a network and a colour.
      </p>

      {/* the allowlist, editable */}
      <div className="mt-5">
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

/**
 * The contact plate, drawn the way it sits on a real card: the outer module,
 * the central pad and the traces running out to the edges. It takes its colour
 * from the face it sits on, so it holds up on every swatch.
 */
function CardChip() {
  return (
    <svg
      viewBox="0 0 40 32"
      className="relative mt-8 h-8 w-10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      aria-hidden
    >
      <g className="opacity-70">
        <rect
          x="0.75"
          y="0.75"
          width="38.5"
          height="30.5"
          rx="4.5"
          fill="currentColor"
          fillOpacity="0.14"
        />
        <rect x="12.5" y="7" width="15" height="18" rx="3" />
        <path
          d="M0.75 11.5h11.75M27.5 11.5h11.75M0.75 20.5h11.75M27.5 20.5h11.75M20 0.75V7M20 25v6.25"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/**
 * The network picker: one choice at a time, opened from the card's own row.
 * Kept as a menu of buttons rather than a native select because the mark is the
 * point — you pick the logo you can see.
 */
function NetworkPicker({
  value,
  onChange,
}: {
  value: Network;
  onChange: (n: Network) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} data-network-picker className="relative mt-4">
      <button
        type="button"
        data-network-toggle
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 rounded-card border border-hairDark px-4 py-3 text-left transition-colors duration-200 hover:border-canvas/30"
      >
        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-canvas/45">
          Card network
        </span>
        <span className="flex items-center gap-3">
          <span data-network-current className="flex items-center gap-3">
            <value.Mark />
            <span className="font-mono text-[12px]">{value.name}</span>
          </span>
          <svg
            viewBox="0 0 16 16"
            className={`h-3.5 w-3.5 text-canvas/50 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden
          >
            <path d="M4 6.5l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <div
        data-network-menu
        role="menu"
        aria-label="Card network"
        hidden={!open}
        className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-card border border-hairDark bg-[#161616] shadow-[0_24px_50px_-30px_rgba(0,0,0,0.9)]"
      >
        {NETWORKS.map((n) => (
          <button
            key={n.id}
            type="button"
            data-network-name={n.name}
            role="menuitemradio"
            aria-checked={n.id === value.id}
            data-network-option={n.id}
            onClick={() => {
              onChange(n);
              setOpen(false);
            }}
            className={`flex w-full items-center gap-3 border-b border-hairDark px-4 py-3 text-left transition-colors duration-150 last:border-0 hover:bg-canvas/[0.06] ${
              n.id === value.id ? "bg-canvas/[0.04]" : ""
            }`}
          >
            <n.Mark />
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[12.5px]">{n.name}</span>
              <span className="block font-mono text-[10px] text-canvas/45">{n.blurb}</span>
            </span>
            {n.id === value.id && (
              <svg
                data-network-tick
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5 shrink-0 text-coral"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M3 8.5l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
