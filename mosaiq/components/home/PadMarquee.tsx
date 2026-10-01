import Link from "next/link";
import { getChain, pads, pairsLabel } from "@/lib/pads";
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
                className="card card-hover flex w-[252px] items-center gap-3 p-3"
              >
                <span className="relative">
                  <PadGlyph pad={p.id} size="lg" className="!rounded-xl" />
                  <ChainDot chain={p.chain} className="absolute -bottom-1 -right-1 size-4 ring-2 ring-[#0c100a]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-[11px] text-fog">
                    {chain.name}
                    <span>{p.featured ? "Home" : "Live"}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-semibold">
                    {p.name} <span className="font-normal text-fog">{getChain(p.chain)!.native}</span>
                  </span>
                  <span className="block truncate text-[11px] text-fog">
                    Pairs <span className="font-semibold text-bone">{pairsLabel(p)}</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
