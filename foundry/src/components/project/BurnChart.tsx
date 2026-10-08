"use client";

import { fmt } from "@/lib/format";

interface Pt { t: number; burned: number; pct: number; reason: string }

/** Minimal SVG line chart of burned supply snapshots. */
export function BurnChart({ points, initialSupply, maxBurn }: { points: Pt[]; initialSupply: number; maxBurn: number }) {
  if (points.length < 2) return <div className="text-sm text-slate-500">Not enough snapshots yet. A point is recorded every minute while the launch runs.</div>;
  const W = 800, H = 200, P = 28;
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  // Scale to the data unless the burn is already near its cap, so early launches are not a flat line.
  const peak = Math.max(...points.map((p) => p.burned));
  const showCap = peak >= maxBurn * 0.5;
  const yMax = (showCap ? Math.max(maxBurn, peak) : peak * 1.25) || 1;
  const x = (t: number) => P + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / yMax) * (H - 2 * P);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.burned).toFixed(1)}`).join(" ");
  const area = `${path} L${x(t1).toFixed(1)},${(H - P).toFixed(1)} L${x(t0).toFixed(1)},${(H - P).toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="burned supply over time">
      <defs>
        <linearGradient id="burnArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff6a1f" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ff6a1f" stopOpacity="0" />
        </linearGradient>
      </defs>
      {showCap && (
        <>
          <line x1={P} x2={W - P} y1={y(maxBurn)} y2={y(maxBurn)} stroke="#fff" strokeOpacity="0.2" strokeDasharray="4 4" />
          <text x={W - P} y={y(maxBurn) - 4} textAnchor="end" fontSize="10" fill="#94a3b8">max burn {fmt(maxBurn)} ({((maxBurn / initialSupply) * 100).toFixed(0)}%)</text>
        </>
      )}
      {!showCap && <text x={W - P} y={P - 8} textAnchor="end" fontSize="10" fill="#94a3b8">cap {fmt(maxBurn)} ({((maxBurn / initialSupply) * 100).toFixed(0)}%)</text>}
      <path d={area} fill="url(#burnArea)" />
      <path d={path} fill="none" stroke="#ff6a1f" strokeWidth="2" />
      <text x={P} y={H - 8} fontSize="10" fill="#64748b">{new Date(t0).toLocaleString()}</text>
      <text x={W - P} y={H - 8} textAnchor="end" fontSize="10" fill="#64748b">{new Date(t1).toLocaleString()}</text>
      <text x={P} y={P - 8} fontSize="10" fill="#94a3b8">burned: {fmt(points[points.length - 1].burned)}</text>
    </svg>
  );
}
