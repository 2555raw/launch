/** Cumulative sparkline rendered as static SVG (no client JS). */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 300;
  const h = 80;
  let acc = 0;
  const cum = values.map((v) => (acc += v));
  const max = Math.max(1, ...cum);
  const pts = cum.map((v, i) => [(i / Math.max(1, cum.length - 1)) * w, h - 4 - (v / max) * (h - 12)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-ember)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-ember)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke="var(--color-ember)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
