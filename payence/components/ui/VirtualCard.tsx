import { Status } from "./Bits";

/**
 * The product's central object: a card issued to one agent, bounded by one
 * policy. Everything on it is a real field of the issuing API.
 */
export function VirtualCard({
  holder = "procurement-agent",
  last4 = "4417",
  limit = "$2,500",
  merchants = "openai.com · aws.amazon.com",
  used = 62,
  compact = false,
}: {
  holder?: string;
  last4?: string;
  limit?: string;
  merchants?: string;
  used?: number;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-card border border-hairDark bg-ink text-canvas ${
        compact ? "p-5" : "p-6 md:p-7"
      }`}
    >
      {/* the one decorative mark: a coral rule along the top edge, cut short */}
      <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-[3px] w-24 bg-coral" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-canvas/50">
            Virtual card
          </p>
          <p className={`mt-2 font-semibold tracking-tight ${compact ? "text-lg" : "text-xl"}`}>
            Payence
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-pill border border-positive/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-positive">
          <i className="h-1.5 w-1.5 rounded-full bg-positive animate-pulseDot" />
          Active
        </span>
      </div>

      <p className={`relative tnum font-mono ${compact ? "mt-7 text-lg" : "mt-10 text-2xl"}`}>
        <span className="text-canvas/40">•••• •••• ••••</span> {last4}
      </p>

      <dl className="relative mt-7 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-hairDark pt-5">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-canvas/45">
            Cardholder
          </dt>
          <dd className="mt-1.5 font-mono text-[13px] text-canvas">{holder}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-canvas/45">
            Monthly limit
          </dt>
          <dd className="mt-1.5 tnum font-mono text-[13px] text-canvas">{limit}</dd>
        </div>
        <div className="col-span-2">
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-canvas/45">
            Allowed merchants
          </dt>
          <dd className="mt-1.5 font-mono text-[13px] text-canvas/85">{merchants}</dd>
        </div>
      </dl>

      <div className="relative mt-6">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-canvas/45">
            Used this cycle
          </span>
          <span className="tnum font-mono text-[11px] text-canvas/70">{used}%</span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-pill bg-canvas/15">
          <i className="block h-full rounded-pill bg-coral" style={{ width: `${used}%` }} />
        </div>
      </div>
    </div>
  );
}

export { Status };
