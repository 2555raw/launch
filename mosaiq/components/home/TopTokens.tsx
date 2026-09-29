"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatUsd } from "@/lib/format";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { chains, defaultPad, getPad } from "@/lib/pads";
import type { PublicLaunch } from "@/lib/types";
import { ChainDot, TokenAvatar } from "@/components/ui/PadGlyph";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function TopTokens({ launches }: { launches: PublicLaunch[] }) {
  const [chain, setChain] = useState<string>("all");
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
            <li key={l.id} className="flex items-center gap-4 px-4 py-3">
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
