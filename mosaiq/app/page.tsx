import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Bento } from "@/components/home/Bento";
import { Hero } from "@/components/home/Hero";
import { PadMarquee } from "@/components/home/PadMarquee";
import { TopTokens } from "@/components/home/TopTokens";
import { ChainDot, PadGlyph } from "@/components/ui/PadGlyph";
import { Reveal } from "@/components/ui/Reveal";
import { getChain, pads, pairsLabel } from "@/lib/pads";
import { queryLaunches, stats as getStats } from "@/lib/server/launches";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stats, latest] = await Promise.all([getStats(30), queryLaunches({ limit: 60 })]);

  return (
    <div className="mx-auto max-w-6xl space-y-16 px-4 py-6 sm:px-6 sm:py-8">
      <div className="space-y-4">
        <Hero counts={stats.byPad} />
        <PadMarquee />
      </div>

      <Reveal>
        <Bento latest={latest} stats={stats} />
      </Reveal>

      <Reveal>
        <TopTokens launches={latest} />
      </Reveal>

      <Reveal className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section aria-labelledby="launchpads">
          <div className="flex items-center justify-between">
            <h2 id="launchpads" className="display text-xl font-semibold">
              Launchpads
            </h2>
            <Link href="/launch" className="inline-flex items-center gap-1 text-sm text-mute hover:text-bone">
              View all <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {pads.map((p) => {
              const chain = getChain(p.chain)!;
              const n = stats.byPad[p.id] ?? 0;
              return (
                <li key={p.id}>
                  <Link href={`/launch?chain=${p.chain}&pad=${p.id}`} className="card card-hover group flex items-center gap-4 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[17px] font-semibold">
                        {p.name}
                        {p.featured && <span className="rounded-full bg-mint/15 px-1.5 py-px text-[10px] font-medium text-mint">home</span>}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-fog">
                        launch on <ChainDot chain={p.chain} className="size-2.5" /> <span className="font-semibold text-bone">{chain.name}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-fog">Pairs {pairsLabel(p)}</p>
                    </div>
                    <PadGlyph pad={p.id} size="md" className="!size-8 !rounded-lg" />
                    <div className="text-right text-xs">
                      <p className="text-fog">{n} {n === 1 ? "launch" : "launches"}</p>
                      <p className="mt-1.5 inline-flex items-center gap-1 text-fog transition-colors group-hover:text-bone">
                        Launch <ArrowUpRight className="size-3" aria-hidden="true" />
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="how-launch-works">
          <h2 id="how-launch-works" className="display text-xl font-semibold">
            How a launch works
          </h2>
          <div className="card mt-4 p-6">
            <p className="text-sm leading-relaxed text-fog">
              Pick {pads.slice(0, -1).map((p) => p.name).join(", ")} or {pads.at(-1)!.name}, fill in the token, then bring your agent.
              The agent places the launch with its {site.name} key. A person on the page can shape the draft but cannot send it.
            </p>
            <Link href="/launch" className="btn btn-ghost btn-sm mt-5">
              Open the launch form
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
