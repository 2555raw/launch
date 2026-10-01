import type { PublicLaunch } from "@/lib/types";

const fmt = (n: number) => {
  if (n === 0) return "0";
  const s = n >= 100 ? n.toFixed(0) : n >= 1 ? n.toFixed(2) : n.toPrecision(2);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
};

/** Bonding-curve progress: real liquidity raised vs what graduates the token to a DEX pool. */
export function CurveBar({ curve, className }: { curve: NonNullable<PublicLaunch["curve"]>; className?: string }) {
  const pct = curve.graduated ? 100 : Math.min(100, curve.target > 0 ? (curve.raised / curve.target) * 100 : 0);
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-mute">{curve.graduated ? "Graduated to a DEX pool" : "Bonding curve"}</span>
        <span className="font-mono text-fog">
          {curve.graduated ? "100%" : `${fmt(curve.raised)} / ${fmt(curve.target)} ${curve.unit} · ${pct < 1 && pct > 0 ? "<1" : Math.round(pct)}%`}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Bonding curve progress"
      >
        <div className="h-full rounded-full bg-mint transition-[width]" style={{ width: `${Math.max(pct, curve.raised > 0 ? 2 : 0)}%` }} />
      </div>
    </div>
  );
}
