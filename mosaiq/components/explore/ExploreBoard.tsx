"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, LayoutGrid, List, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatUsd } from "@/lib/format";
import { chains, getChain, getPad } from "@/lib/pads";
import type { PublicLaunch } from "@/lib/types";
import { LogoMark } from "@/components/ui/Logo";
import { ChainDot, PadGlyph, TokenAvatar } from "@/components/ui/PadGlyph";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyAddress } from "@/components/ui/CopyAddress";
import { CurveBar } from "@/components/ui/CurveBar";
import { TimeAgo } from "@/components/ui/TimeAgo";

type Sort = "newest" | "oldest" | "marketcap";
const VIEW_KEY = "picker.explore.view";

export function ExploreBoard({ launches, initial }: { launches: PublicLaunch[]; initial: { q: string; sort: Sort; chain: string } }) {
  const pathname = usePathname();
  const [q, setQ] = useState(initial.q);
  const [sort, setSort] = useState<Sort>(initial.sort);
  const [chain, setChain] = useState(initial.chain);
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "grid" || v === "list") setView(v);
    } catch {
      /* storage unavailable */
    }
  }, []);

  function changeView(v: "grid" | "list") {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage unavailable */
    }
  }

  // Reflect filters in the URL so results can be shared.
  useEffect(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (sort !== "newest") p.set("sort", sort);
    if (chain !== "all") p.set("chain", chain);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [q, sort, chain, pathname]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const time = (l: PublicLaunch) => new Date(l.submittedAt ?? l.createdAt).getTime();
    return launches
      .filter((l) => chain === "all" || l.chain === chain)
      .filter(
        (l) =>
          !needle ||
          l.name.toLowerCase().includes(needle) ||
          l.ticker.toLowerCase().includes(needle) ||
          l.address?.toLowerCase().includes(needle) ||
          l.agentName?.toLowerCase().includes(needle),
      )
      .sort((a, b) =>
        sort === "oldest" ? time(a) - time(b) : sort === "marketcap" ? (b.marketCapUsd ?? -1) - (a.marketCapUsd ?? -1) || time(b) - time(a) : time(b) - time(a),
      );
  }, [launches, q, sort, chain]);

  const filtered = q.trim() !== "" || chain !== "all";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="display flex items-baseline gap-3 text-3xl font-semibold sm:text-4xl">
          Latest launches
          <span className="rounded-full border border-line-strong px-2 py-0.5 font-mono text-xs font-normal text-fog" aria-label={`${rows.length} shown`}>
            {rows.length}
          </span>
        </h2>
        <p className="text-sm text-mute">Across {chains.length} networks</p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-mute" aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, ticker, address or agent"
            aria-label="Search launches"
            className="field h-12 pl-11 pr-10"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-mute hover:text-bone">
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <label className="sr-only" htmlFor="explore-sort">
            Sort launches
          </label>
          <select id="explore-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="field h-12 w-auto flex-1 cursor-pointer pr-8 sm:w-44 sm:flex-none">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="marketcap">Market cap</option>
          </select>
          <div className="flex rounded-xl border border-line-strong p-1" role="group" aria-label="Layout">
            {(
              [
                ["grid", LayoutGrid, "Grid view"],
                ["list", List, "List view"],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                aria-label={label}
                aria-pressed={view === v}
                onClick={() => changeView(v)}
                className={cn("grid w-10 place-items-center rounded-lg transition-colors", view === v ? "bg-surface-3 text-bone" : "text-mute hover:text-bone")}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by network">
        {[{ id: "all", name: "All networks" }, ...chains].map((c) => (
          <button key={c.id} type="button" aria-pressed={chain === c.id} onClick={() => setChain(c.id)} className="chip">
            {c.id !== "all" && <ChainDot chain={c.id} className="size-2" />}
            {c.name}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {rows.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-16 text-center">
            <LogoMark className="size-10" />
            <h3 className="display mt-5 text-2xl font-semibold">{launches.length === 0 ? "The first launch starts with you." : "No launches match."}</h3>
            <p className="mt-2 max-w-sm text-sm text-fog">
              {launches.length === 0
                ? "Draft a token on the network you prefer. Once your agent submits it, it appears here."
                : "Try another name, ticker or network."}
            </p>
            {launches.length === 0 || !filtered ? (
              <Link href="/launch" className="btn btn-primary mt-6">
                Create token <Plus className="size-4" aria-hidden="true" />
              </Link>
            ) : (
              <button
                type="button"
                className="btn btn-ghost mt-6"
                onClick={() => {
                  setQ("");
                  setChain("all");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : view === "grid" ? (
          <motion.ul layout className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence initial={false}>
              {rows.map((l) => (
                <motion.li key={l.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
                  <LaunchCard l={l} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-mute">
                  <th scope="col" className="px-4 py-3 font-normal">Token</th>
                  <th scope="col" className="px-4 py-3 font-normal">Pad</th>
                  <th scope="col" className="px-4 py-3 font-normal">Status</th>
                  <th scope="col" className="px-4 py-3 font-normal">CA</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">Market cap</th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((l) => (
                  <tr key={l.id} className="transition-colors hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <TokenAvatar image={l.image} ticker={l.ticker} color={getPad(l.pad)?.color} className="size-9 rounded-lg text-xs" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{l.name}</p>
                          <p className="font-mono text-xs text-mute">${l.ticker}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <PadGlyph pad={l.pad} size="sm" /> {getPad(l.pad)?.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-3 text-fog">{l.address ? <CopyAddress address={l.address} /> : "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatUsd(l.marketCapUsd, true)}</td>
                    <td className="px-4 py-3 text-right text-fog">
                      <TimeAgo iso={l.submittedAt ?? l.createdAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function LaunchCard({ l }: { l: PublicLaunch }) {
  const pad = getPad(l.pad);
  const chain = getChain(l.chain);
  return (
    <article className="card card-hover flex h-full flex-col p-5">
      <div className="flex items-start gap-4">
        <TokenAvatar image={l.image} ticker={l.ticker} color={pad?.color} className="size-14 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-medium">{l.name}</h3>
          <p className="font-mono text-sm text-fog">${l.ticker}</p>
        </div>
        <StatusBadge status={l.status} />
      </div>
      {l.description && <p className="mt-4 line-clamp-2 text-sm text-fog">{l.description}</p>}
      <dl className="mt-auto grid grid-cols-2 gap-3 pt-5 text-xs">
        <div>
          <dt className="text-mute">Pad</dt>
          <dd className="mt-1 flex items-center gap-1.5 text-bone">
            <ChainDot chain={l.chain} className="size-2" /> {pad?.name} · {chain?.name}
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-mute">Market cap</dt>
          <dd className="mt-1 font-mono text-bone">{formatUsd(l.marketCapUsd, true)}</dd>
        </div>
        <div>
          <dt className="text-mute">Pair</dt>
          <dd className="mt-1 truncate text-bone">{l.pair}</dd>
        </div>
        <div className="text-right">
          <dt className="text-mute">Submitted</dt>
          <dd className="mt-1 text-bone">
            <TimeAgo iso={l.submittedAt ?? l.createdAt} />
          </dd>
        </div>
      </dl>
      {l.curve && <CurveBar curve={l.curve} className="mt-4" />}
      <div className="mt-4 border-t border-line pt-4 text-xs">
        <p className="text-mute">CA</p>
        {l.address ? (
          <div className="mt-1 flex items-start justify-between gap-3">
            <CopyAddress address={l.address} full className="text-bone" />
            {chain && (
              <a href={`${chain.explorer}${l.address}`} target="_blank" rel="noopener noreferrer" aria-label="Open in explorer" className="shrink-0 text-fog hover:text-bone">
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        ) : (
          <p className="mt-1 text-fog">Not on-chain yet</p>
        )}
      </div>
    </article>
  );
}
