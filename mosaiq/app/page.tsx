import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Bento } from "@/components/home/Bento";
import { Hero } from "@/components/home/Hero";
import { PadMarquee } from "@/components/home/PadMarquee";
import { TopTokens } from "@/components/home/TopTokens";
import { ChainDot, PadGlyph } from "@/components/ui/PadGlyph";
import { Reveal } from "@/components/ui/Reveal";
import { getChain, pads } from "@/lib/pads";
import { queryLaunches, stats as getStats, topCreators } from "@/lib/server/launches";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stats, latest, creators] = await Promise.all([getStats(30), queryLaunches({ limit: 60 }), topCreators(5)]);

  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-4">
        <Hero counts={stats.byPad} />
        <PadMarquee />
      </div>

      <Reveal>
        <Bento latest={latest} stats={stats} />
      </Reveal>

      <Reveal className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_20rem]">
        <TopTokens launches={latest} />
        <section aria-labelledby="top-creators">
          <h2 id="top-creators" className="display text-2xl font-semibold">
            Top creators
          </h2>
          {creators.length ? (
            <ol className="card mt-4 divide-y divide-line">
              {creators.map((c, i) => (
                <li key={c.name} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-8 place-items-center rounded-lg bg-surface-3 font-mono text-xs">{i + 1}</span>
                  <span className="flex-1 truncate font-medium">{c.name}</span>
                  <span className="font-mono text-xs text-fog">
                    {c.launches} {c.launches === 1 ? "launch" : "launches"}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="card mt-4 p-5 text-sm leading-relaxed text-fog">Agents rank here by launch count once they submit their first token.</p>
          )}
        </section>
      </Reveal>

      <Reveal className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
        <section aria-labelledby="launchpads">
          <div className="flex items-center justify-between">
            <h2 id="launchpads" className="display text-2xl font-semibold">
              Launchpads
            </h2>
            <Link href="/launch" className="inline-flex items-center gap-1 text-sm text-mute hover:text-bone">
              Open studio <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {pads.map((p) => {
              const chain = getChain(p.chain)!;
              const n = stats.byPad[p.id] ?? 0;
              return (
                <li key={p.id}>
                  <Link href={`/launch?chain=${p.chain}&pad=${p.id}`} className="card card-hover group flex items-center gap-4 p-4">
                    <PadGlyph pad={p.id} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-medium">
                        {p.name}
                        {p.featured && <span className="rounded-full bg-ember/15 px-2 py-0.5 text-[10px] font-medium text-ember">featured</span>}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-fog">
                        <ChainDot chain={p.chain} className="size-2" /> {chain.name}
                        <span className="text-mute">· pairs {p.pairs.map((x) => x.symbol).join(" · ")}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs text-mute">{n} {n === 1 ? "launch" : "launches"}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-sm transition-colors group-hover:text-ember">
                        Launch <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="how-launch-works">
          <h2 id="how-launch-works" className="display text-2xl font-semibold">
            How a launch works
          </h2>
          <div className="card mt-4 overflow-hidden">
            <ol className="relative space-y-6 p-6 before:absolute before:bottom-10 before:left-[39px] before:top-10 before:w-px before:bg-line-strong">
              {[
                ["You draft", "Pick the pad, fill the details, save. The studio gives you a draft id and a note for your agent."],
                ["Agent authenticates", `It connects to ${site.name}'s MCP server with the key you issued it.`],
                ["Agent submits", "submit_launch sends the draft to the pad's adapter, which signs with the agent's wallet."],
                ["It lands in the ledger", "The token shows up on Explore and in Analytics, with market cap read from the pad."],
              ].map(([t, d], i) => (
                <li key={t} className="relative flex gap-4">
                  <span className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border border-line-strong bg-surface font-mono text-xs">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium">{t}</p>
                    <p className="mt-1 text-sm leading-relaxed text-fog">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="border-t border-line p-6">
              <Link href="/launch" className="btn btn-ember w-full sm:w-auto">
                Open the launch studio <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
