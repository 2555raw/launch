import type { Metadata } from "next";
import Link from "next/link";
import { LaunchChart } from "@/components/analytics/LaunchChart";
import { PadGlyph } from "@/components/ui/PadGlyph";
import { Reveal } from "@/components/ui/Reveal";
import { formatNumber, formatUsd } from "@/lib/format";
import { getChain, pads } from "@/lib/pads";
import { stats as getStats } from "@/lib/server/launches";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Launch counts, market cap and per-pad activity for every token submitted through the studio.",
  alternates: { canonical: "/analytics" },
};

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const stats = await getStats(30);
  const maxPad = Math.max(1, ...Object.values(stats.byPad));
  const cards = [
    { label: "Tracked market cap", value: formatUsd(stats.marketCapUsd, true), sub: "Read from each pad" },
    { label: "Total launches", value: formatNumber(stats.totalLaunches), sub: "All time" },
    { label: "Launches · 24h", value: formatNumber(stats.launches24h), sub: "Past 24 hours" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-2">
        <div>
          <h1 className="metal display pb-1 text-[clamp(2.25rem,5vw,3.25rem)] font-bold leading-none">Protocol analytics</h1>
        </div>
        <p className="flex items-center gap-2 text-sm text-mute">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-mint" /> Recorded activity
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((c, i) => (
          <Reveal key={c.label} delay={i * 0.05}>
            <Link href="/explore" className="card card-hover block p-6">
              <p className="text-sm text-fog">{c.label}</p>
              <p className="display mt-3 text-4xl font-semibold tabular-nums">{c.value}</p>
              <p className="mt-2 text-sm text-mute">{c.sub}</p>
            </Link>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <LaunchChart initial={stats} />
      </Reveal>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.3fr_1fr]">
        <Reveal>
          <section aria-labelledby="by-pad" className="card h-full p-6">
            <h2 id="by-pad" className="font-medium">
              Launches by pad
            </h2>
            <ul className="mt-5 space-y-4">
              {pads.map((p) => {
                const n = stats.byPad[p.id] ?? 0;
                return (
                  <li key={p.id} className="flex items-center gap-3">
                    <PadGlyph pad={p.id} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between text-sm">
                        <span>
                          {p.name} <span className="text-mute">· {getChain(p.chain)!.name}</span>
                        </span>
                        <span className="font-mono text-fog">{n}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(n / maxPad) * 100}%`, background: p.color }} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </Reveal>
        <Reveal>
          <section aria-labelledby="about-numbers" className="card h-full p-6">
            <h2 id="about-numbers" className="font-medium">
              Where the numbers come from
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-fog">
              Launch counts are the tokens in the ledger: everything an agent has submitted. Drafts are private and never counted.
              Market cap is read from each pad&apos;s adapter; a pad without a live adapter reports none rather than an estimate.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-fog">
              {stats.totalLaunches === 0 ? "No launches yet. " : ""}
              <Link href="/launch" className="text-bone underline decoration-accent/60 underline-offset-4 hover:decoration-accent">
                Open the studio
              </Link>{" "}
              to draft one.
            </p>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
