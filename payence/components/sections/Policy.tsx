import { Reveal } from "../ui/Reveal";
import { Label, Status } from "../ui/Bits";

const RULES = [
  ["Agent spend", "$4,000 / month · $500 per authorization", "policy" as const],
  ["Card isolation", "One card per agent, never pooled", "policy" as const],
  ["Merchant restrictions", "4 allowed · everything else declined", "policy" as const],
  ["Approval queue", "Over $500 → human sign-off", "policy" as const],
  ["Transaction visibility", "Streamed to finance in real time", "policy" as const],
];

export function Policy() {
  return (
    <section className="border-t border-hair py-24 md:py-32">
      <div className="shell grid grid-cols-1 gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <Reveal>
            <Label>Policy engine</Label>
            <h2 className="mt-6 text-title font-extrabold">
              The rules live
              <br />
              outside the model.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-8 max-w-[46ch] text-[16.5px] leading-[1.65] text-muted">
              A policy is a document, not a paragraph in a system prompt. It decides what an agent
              may spend, which card it holds, where that card clears, what needs a human, and who
              sees the charge — and it is evaluated on our side, every single time.
            </p>
          </Reveal>
          <Reveal delay={0.14}>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Status tone="policy">Evaluated pre-auth</Status>
              <Status tone="approved">Versioned</Status>
              <Status tone="blocked">Immutable log</Status>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-hair px-5 py-4 md:px-6">
              <p className="font-mono text-[12.5px]">pol_procure_2500</p>
              <span className="font-mono text-[11px] text-muted">v4 · active</span>
            </div>
            <ul className="divide-y divide-hair">
              {RULES.map(([k, v]) => (
                <li key={k} className="flex flex-wrap items-baseline gap-x-6 gap-y-2 px-5 py-5 md:px-6">
                  <span className="w-full font-mono text-[10px] uppercase tracking-[0.16em] text-muted sm:w-44">
                    {k}
                  </span>
                  <span className="flex-1 text-[14.5px]">{v}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-hair bg-shell px-5 py-4 md:px-6">
              <p className="font-mono text-[11.5px] leading-relaxed text-muted">
                <span className="text-coral">last decision</span> · 12:03:52 · declined
                unknown-vendor.io — merchant not in allowlist
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
