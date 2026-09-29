import Link from "next/link";
import { getChain, pads } from "@/lib/pads";
import { ChainDot, PadGlyph } from "@/components/ui/PadGlyph";

/** Endless strip of launchpad chips. Pauses on hover; stops under reduced motion. */
export function PadMarquee() {
  const row = [...pads, ...pads];
  return (
    <div
      className="group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]"
      aria-label="Supported launchpads"
    >
      <ul className="flex w-max animate-marquee gap-3 py-1 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
        {row.map((p, i) => {
          const chain = getChain(p.chain)!;
          const clone = i >= pads.length;
          return (
            <li key={`${p.id}-${i}`} aria-hidden={clone || undefined}>
              <Link
                href={`/launch?chain=${p.chain}&pad=${p.id}`}
                tabIndex={clone ? -1 : undefined}
                className="card card-hover flex w-64 items-center gap-3 p-3"
              >
                <PadGlyph pad={p.id} size="lg" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-[11px] text-mute">
                    <span className="inline-flex items-center gap-1.5">
                      <ChainDot chain={p.chain} className="size-2" /> {chain.name}
                    </span>
                    <span className="text-mint">Live</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate font-mono text-[11px] text-fog">{p.pairs.map((x) => x.symbol).join(" · ")}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
