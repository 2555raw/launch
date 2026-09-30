import { Footprints } from "lucide-react";
import { DEMO_TICKER } from "@/lib/demo-data";
import { fmtSteps } from "@/lib/format";

export function Ticker() {
  const items = [...DEMO_TICKER, ...DEMO_TICKER];
  return (
    <div className="border-y border-white/10 bg-ink-950/60 backdrop-blur-md">
      <div className="flex items-center">
        <div className="z-10 flex shrink-0 items-center gap-2 border-r border-white/10 bg-ink-950/80 px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/60 sm:px-6">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-neon" />
          Trail feed <span className="text-amber-200/70">· demo</span>
        </div>
        <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
          <div className="flex w-max animate-marquee gap-10 py-3 pl-6 hover:[animation-play-state:paused]">
            {items.map((t, i) => (
              <div key={i} className="flex items-center gap-2.5 whitespace-nowrap text-[12.5px]">
                <Footprints className="h-3.5 w-3.5 text-lime-400/80" />
                <span className="font-mono text-white/80">{t.wallet}</span>
                <span className="font-mono text-lime-300 tabular">{fmtSteps(t.steps)}</span>
                <span className="text-white/40">steps · {t.place}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
