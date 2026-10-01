"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Copy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatUsd } from "@/lib/format";
import { pumpCoinUrl } from "@/lib/onchain";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { chains, defaultPad, getChain, getPad } from "@/lib/pads";
import type { PublicLaunch } from "@/lib/types";
import { ChainDot, TokenAvatar } from "@/components/ui/PadGlyph";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useCopy } from "@/components/ui/useCopy";
import { CurveBar } from "@/components/ui/CurveBar";

export function TopTokens({ launches }: { launches: PublicLaunch[] }) {
  const [chain, setChain] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);
  const { copied, copy } = useCopy();
  const rows = useMemo(
    () =>
      launches
        .filter((l) => chain === "all" || l.chain === chain)
        .sort((a, b) => (b.marketCapUsd ?? -1) - (a.marketCapUsd ?? -1))
        .slice(0, 6),
    [launches, chain],
  );

  return (
    <section aria-labelledby="top-tokens">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="top-tokens" className="display text-xl font-semibold">
          Top tokens
        </h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by chain">
          {[{ id: "all", name: "All chains" }, ...chains].map((c) => (
            <button key={c.id} type="button" aria-pressed={chain === c.id} onClick={() => setChain(c.id)} className="chip h-7 text-xs">
              {c.id !== "all" && <ChainDot chain={c.id} className="size-2" />}
              {c.name}
            </button>
          ))}
        </div>
        <Link href="/explore?sort=marketcap" className="ml-auto inline-flex items-center gap-1 text-sm text-mute hover:text-bone">
          View all <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      {rows.length ? (
        <ol className="card mt-4 divide-y divide-line">
          {rows.map((l, i) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setOpen(open === l.id ? null : l.id)}
                aria-expanded={open === l.id}
                aria-controls={`ca-${l.id}`}
                className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-2/60"
              >
                <span className="w-5 font-mono text-xs text-mute">{i + 1}</span>
                <TokenAvatar image={l.image} ticker={l.ticker} color={getPad(l.pad)?.color} className="size-10 rounded-lg text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {l.name} <span className="font-mono text-xs text-mute">${l.ticker}</span>
                  </p>
                  <p className="truncate text-xs text-mute">
                    {getPad(l.pad)?.name} · <TimeAgo iso={l.submittedAt ?? l.createdAt} />
                  </p>
                </div>
                <StatusBadge status={l.status} className="hidden sm:inline-flex" />
                <span className="w-20 text-right font-mono text-sm">{formatUsd(l.marketCapUsd, true)}</span>
                <ChevronDown className={cn("size-4 shrink-0 text-mute transition-transform", open === l.id && "rotate-180")} aria-hidden="true" />
              </button>
              <AnimatePresence initial={false}>
                {open === l.id && (
                  <motion.div
                    id={`ca-${l.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
                      {l.curve && <CurveBar curve={l.curve} className="mb-4" />}
                      {l.address ? (
                        <>
                          <p className="mb-2 text-xs text-mute">CA</p>
                          <button
                            type="button"
                            onClick={() => copy(l.address!, l.id)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-ink-2 px-4 py-3 text-left font-mono text-sm transition hover:border-accent/40"
                            aria-label={`Copy contract address of ${l.name}`}
                          >
                            <span className="min-w-0 break-all">{l.address}</span>
                            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-fog">
                              {copied === l.id ? <Check className="size-4 text-mint" /> : <Copy className="size-4" />}
                              {copied === l.id ? "Copied" : "Copy"}
                            </span>
                          </button>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {l.pad === "pump" && (
                              <a href={pumpCoinUrl(l.address)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                                Pump.fun <ArrowUpRight className="size-3.5" />
                              </a>
                            )}
                            <a href={`${getChain(l.chain)?.explorer}${l.address}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                              Explorer <ArrowUpRight className="size-3.5" />
                            </a>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-fog">No contract address yet. It shows here once the pad confirms the token.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          ))}
        </ol>
      ) : (
        <div className="card mt-4 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-medium">{chain === "all" ? "The first launches rank here" : `Nothing on ${chains.find((c) => c.id === chain)?.name} yet`}</p>
            <p className="mt-1 text-sm text-fog">Every token submitted through the studio shows up here with its market cap.</p>
          </div>
          <Link href={`/launch?chain=${defaultPad.chain}&pad=${defaultPad.id}`} className="btn btn-primary shrink-0">
            Launch on {defaultPad.name}
          </Link>
        </div>
      )}
    </section>
  );
}
