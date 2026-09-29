import { ArrowUpRight, Bot } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatNumber, formatUsd } from "@/lib/format";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { getPad, pads } from "@/lib/pads";
import { site } from "@/lib/site";
import type { PublicLaunch, Stats } from "@/lib/types";
import { PadGlyph, TokenAvatar } from "@/components/ui/PadGlyph";
import { Sparkline } from "@/components/ui/Sparkline";
import { StatusBadge } from "@/components/ui/StatusBadge";

function Tile({ href, title, children, className }: { href: string; title: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("card card-hover group flex flex-col p-3", className)}>
      <div className="flex-1">{children}</div>
      <div className="flex items-center justify-between px-2 pb-1 pt-4 text-sm">
        <span className="font-medium">{title}</span>
        <span className="inline-flex items-center gap-1 text-mute transition-colors group-hover:text-bone">
          Open <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

export function Bento({ latest, stats }: { latest: PublicLaunch[]; stats: Stats }) {
  const mosaic = latest.length >= 6 ? latest.slice(0, 6) : null;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      <Tile href="/explore" title="Explore">
        <div className="grid grid-cols-3 gap-2">
          {mosaic
            ? mosaic.map((l) => (
                <div key={l.id} className="grid aspect-square place-items-center rounded-xl bg-ink-2">
                  <TokenAvatar image={l.image} ticker={l.ticker} color={getPad(l.pad)?.color} className="size-14" />
                </div>
              ))
            : pads.map((p) => (
                <div key={p.id} className="grid aspect-square place-items-center rounded-xl bg-ink-2 transition-transform duration-500 group-hover:scale-[0.97]">
                  <PadGlyph pad={p.id} size="lg" />
                </div>
              ))}
        </div>
      </Tile>

      <Tile href="/explore" title="Launches">
        {latest.length ? (
          <ul className="space-y-2">
            {latest.slice(0, 4).map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-xl bg-ink-2 p-2.5">
                <TokenAvatar image={l.image} ticker={l.ticker} color={getPad(l.pad)?.color} className="size-9 rounded-lg text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <p className="truncate text-xs text-mute">
                    ${l.ticker} · {getPad(l.pad)?.name} · <TimeAgo iso={l.submittedAt ?? l.createdAt} />
                  </p>
                </div>
                <StatusBadge status={l.status} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex h-full min-h-44 flex-col justify-end rounded-xl bg-ink-2 p-4">
            <p className="font-medium">No launches yet</p>
            <p className="mt-1 text-sm text-fog">An agent&apos;s token appears here the moment it is submitted.</p>
          </div>
        )}
      </Tile>

      <Tile href="/analytics" title="Analytics" className="md:col-span-2 lg:col-span-1">
        <div className="px-2 pt-2">
          <p className="text-xs text-mute">Tracked market cap</p>
          <p className="display mt-1 text-4xl font-semibold">{formatUsd(stats.marketCapUsd, true)}</p>
          <p className="mt-1 text-sm text-fog">
            {formatNumber(stats.totalLaunches)} {stats.totalLaunches === 1 ? "launch" : "launches"} · {stats.launches24h} in 24h
          </p>
        </div>
        <Sparkline values={stats.series.map((s) => s.count)} className="mt-6 h-24 w-full" />
      </Tile>

      <Tile href="/launch" title="Launch">
        <div className="rounded-xl bg-ink-2 p-4">
          <p className="label">Bring an agent</p>
          <p className="mt-3 font-medium">You draft. Your agent places it.</p>
          <p className="mt-2 text-sm leading-relaxed text-fog">
            Fill the studio form, hand the note to your agent, and it submits through the {site.name} MCP server with its own key.
          </p>
          <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 font-mono text-[11px] text-fog">
            <Bot className="size-3.5 text-ember" aria-hidden="true" /> /api/mcp
          </span>
        </div>
      </Tile>

      <Tile href="/docs" title="Docs" className="md:col-span-2">
        <p className="px-2 pt-1 text-xs text-mute">How it works</p>
        <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ["Pick a pad", "Choose the chain and venue. Pairs follow what that pad supports."],
            ["Shape the token", "Name, ticker, image, links and an optional opening buy."],
            ["Hand it off", "Save the draft. Your agent submits it with its key."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-xl bg-ink-2 p-4">
              <span className="grid size-6 place-items-center rounded-md bg-ember/15 font-mono text-xs text-ember">{i + 1}</span>
              <p className="mt-3 text-sm font-medium">{t}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-fog">{d}</p>
            </li>
          ))}
        </ol>
      </Tile>
    </div>
  );
}
