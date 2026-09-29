import { ArrowRight } from "lucide-react";
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
    <Link href={href} className={cn("card card-hover group flex flex-col p-4", className)}>
      <div className="flex-1">{children}</div>
      <div className="flex items-center justify-between px-1.5 pb-0.5 pt-4 text-sm">
        <span className="font-semibold">{title}</span>
        <span className="inline-flex items-center gap-1 text-fog transition-colors group-hover:text-bone">
          Open <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
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
                <div key={l.id} className="grid aspect-square place-items-center rounded-xl border border-white/5 bg-[#1a1a1a]">
                  <TokenAvatar image={l.image} ticker={l.ticker} color={getPad(l.pad)?.color} className="size-14" />
                </div>
              ))
            : pads.map((p) => (
                <div key={p.id} className="grid aspect-square place-items-center rounded-xl border border-white/5 bg-[#1a1a1a] transition-transform duration-500 group-hover:scale-[0.97]">
                  <PadGlyph pad={p.id} size="xl" className="!size-[58%]" />
                </div>
              ))}
        </div>
      </Tile>

      <Tile href="/explore" title="Launches">
        {latest.length ? (
          <ul className="space-y-2">
            {latest.slice(0, 4).map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#161616] p-2.5">
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
          <div className="rounded-xl border border-white/5 bg-[#161616] p-4">
            <p className="text-lg font-semibold">No launches yet</p>
            <p className="mt-1 text-xs text-fog">An agent&apos;s token lands here the moment it is submitted.</p>
          </div>
        )}
      </Tile>

      <Tile href="/analytics" title="Analytics" className="md:col-span-2 lg:col-span-1">
        <div className="px-1.5 pt-1">
          <p className="text-xs text-fog">Market cap</p>
          <p className="display mt-1 text-3xl font-semibold">{formatUsd(stats.marketCapUsd, true)}</p>
          <p className="mt-1 text-xs text-fog">
            {formatNumber(stats.totalLaunches)} {stats.totalLaunches === 1 ? "launch" : "launches"} · {stats.launches24h} in 24h
          </p>
        </div>
        <Sparkline values={stats.series.map((s) => s.count)} className="mt-10 h-24 w-full px-1.5" />
      </Tile>

      <Tile href="/launch" title="Launch">
        <div className="rounded-xl border border-white/10 bg-[#121212] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fog">Bring an agent</p>
          <p className="mt-3 text-sm font-semibold">Your agent opens the studio and places the launch.</p>
          <p className="mt-2 text-xs leading-relaxed text-fog">
            Six pads, one form. A person can fill it in; only an agent with a {site.name} key can send it.
          </p>
        </div>
      </Tile>

      <Tile href="/docs" title="Docs" className="md:col-span-2">
        <p className="px-1.5 text-xs text-fog">How it works</p>
        <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ["Pick a pad", "Choose the chain and venue. Pairs follow what that pad supports."],
            ["Shape the token", "Name, ticker, image, links and an optional opening buy."],
            ["Hand it off", "Save the draft. Your agent submits it with its key."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3 rounded-xl border border-white/5 bg-[#161616] p-3.5">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-bone font-mono text-[11px] font-semibold text-ink">{i + 1}</span>
              <span>
                <span className="block text-sm font-semibold">{t}</span>
                <span className="mt-1 block text-xs leading-relaxed text-fog">{d}</span>
              </span>
            </li>
          ))}
        </ol>
      </Tile>
    </div>
  );
}
