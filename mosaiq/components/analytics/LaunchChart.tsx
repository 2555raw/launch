"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { shortDate } from "@/lib/format";
import type { Stats } from "@/lib/types";

type Range = "7d" | "30d" | "all";
type Mode = "total" | "daily";

const W = 800;
const H = 240;
const PAD_T = 16;
const PAD_B = 8;

export function LaunchChart({ initial }: { initial: Stats }) {
  const [range, setRange] = useState<Range>("30d");
  const [mode, setMode] = useState<Mode>("total");
  const [series, setSeries] = useState(initial.series);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [hover, setHover] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const ctrl = new AbortController();
    setState("loading");
    fetch(`/api/stats?range=${range}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((s: Stats) => {
        setSeries(s.series);
        setState("idle");
      })
      .catch((e) => e?.name !== "AbortError" && setState("error"));
    return () => ctrl.abort();
  }, [range, attempt]);

  const values = useMemo(() => {
    let acc = 0;
    return series.map((s) => (mode === "total" ? (acc += s.count) : s.count));
  }, [series, mode]);

  const max = Math.max(1, ...values);
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * W;
  const y = (v: number) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const band = W / Math.max(1, values.length);
  const barW = Math.max(2, band * 0.6);

  const total = series.reduce((s, d) => s + d.count, 0);
  const shown = hover ?? values.length - 1;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const i = mode === "daily" ? Math.floor(ratio * values.length) : Math.round(ratio * (values.length - 1));
    setHover(Math.max(0, Math.min(values.length - 1, i)));
  }

  return (
    <section aria-labelledby="chart-title" className="card p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="chart-title" className="text-sm text-fog">
            {mode === "total" ? "Launches, cumulative" : "Launches per day"}
          </h2>
          <p className="display mt-2 text-4xl font-semibold tabular-nums" aria-live="polite">
            {values[shown] ?? 0}
          </p>
          <p className="mt-1 text-sm text-mute">{series[shown] ? shortDate(series[shown].date) : "—"}{hover === null ? " · today" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented
            label="Series"
            value={mode}
            onChange={setMode}
            options={[
              ["total", "Total"],
              ["daily", "Daily"],
            ]}
          />
          <Segmented
            label="Range"
            value={range}
            onChange={setRange}
            options={[
              ["7d", "7D"],
              ["30d", "30D"],
              ["all", "All"],
            ]}
          />
        </div>
      </div>

      <div className="relative mt-6">
        {state !== "idle" && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-surface/70 backdrop-blur-[2px]">
            {state === "loading" ? (
              <LoaderCircle className="size-5 animate-spin text-fog" aria-label="Loading" />
            ) : (
              <p className="flex items-center gap-2 text-sm text-danger" role="alert">
                <TriangleAlert className="size-4" /> Could not load this range.
                <button type="button" className="underline" onClick={() => setAttempt((n) => n + 1)}>
                  Retry
                </button>
              </p>
            )}
          </div>
        )}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-56 w-full touch-none sm:h-64"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`${total} launches in the selected range`}
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={PAD_T + f * (H - PAD_T - PAD_B)} y2={PAD_T + f * (H - PAD_T - PAD_B)} stroke="var(--color-line)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
          ))}
          {mode === "total" ? (
            <>
              <path d={area} fill="url(#chart-fill)" />
              <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </>
          ) : (
            values.map((v, i) => (
              <rect
                key={series[i].date}
                x={band * i + (band - barW) / 2}
                y={y(v)}
                width={barW}
                height={Math.max(0, H - PAD_B - y(v))}
                rx="2"
                fill={hover === i ? "var(--color-accent-soft)" : "var(--color-accent)"}
                opacity={v ? 0.9 : 0.15}
              />
            ))
          )}
          {hover !== null && (
            <line x1={mode === "daily" ? band * (hover + 0.5) : x(hover)} x2={mode === "daily" ? band * (hover + 0.5) : x(hover)} y1="0" y2={H} stroke="var(--color-line-strong)" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        <div className="mt-3 flex justify-between text-xs text-mute">
          <span>{series[0] ? shortDate(series[0].date) : ""}</span>
          <span>
            {total} {total === 1 ? "launch" : "launches"} in range
          </span>
          <span>{series.at(-1) ? shortDate(series.at(-1)!.date) : ""}</span>
        </div>
      </div>

      <table className="sr-only">
        <caption>Launches per day</caption>
        <tbody>
          {series.map((s) => (
            <tr key={s.date}>
              <th scope="row">{s.date}</th>
              <td>{s.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border border-line-strong p-1">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn("rounded-full px-3 py-1 text-xs transition-colors", value === v ? "bg-bone text-ink" : "text-fog hover:text-bone")}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
