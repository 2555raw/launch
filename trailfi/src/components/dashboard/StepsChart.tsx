"use client";

import { motion } from "framer-motion";
import { fmtDate, fmtSteps } from "@/lib/format";
import { cn } from "@/lib/cn";

export interface DayPoint {
  day: string;
  steps: number;
  status?: string;
}

/** Bar chart of daily steps with the goal as a reference line. */
export function StepsChart({ data, goal, height = 200 }: { data: DayPoint[]; goal: number; height?: number }) {
  const max = Math.max(goal * 1.25, ...data.map((d) => d.steps), 1);
  const goalPct = (goal / max) * 100;
  return (
    <div className="relative" style={{ height }}>
      {/* Plot area: the goal line and the bars share the same vertical scale. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[22px] top-0">
        <div className="absolute inset-x-0 z-10 flex translate-y-1/2 items-center" style={{ bottom: `${goalPct}%` }}>
          <div className="h-px flex-1 border-t border-dashed border-lime-400/50" />
          <span className="ml-2 rounded-md bg-lime-400/15 px-1.5 py-0.5 font-mono text-[10px] text-lime-300">goal {fmtSteps(goal)}</span>
        </div>
      </div>
      <div className="absolute inset-0 flex items-end gap-1.5 pb-[22px] pr-20 sm:gap-2.5">
        {data.map((d, i) => {
          const met = d.steps >= goal;
          const pending = d.status === "unverified" || d.status === "flagged";
          return (
            <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
              <div className="pointer-events-none absolute -top-2 left-1/2 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-white/10 bg-ink-900 px-2 py-1 font-mono text-[11px] opacity-0 transition group-hover:opacity-100">
                {fmtSteps(d.steps)} · {fmtDate(d.day)}
                {d.status && <span className="ml-1 text-white/40">({d.status})</span>}
              </div>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(d.steps / max) * 100}%` }}
                transition={{ delay: i * 0.03, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  "min-h-[3px] w-full rounded-md transition group-hover:brightness-125",
                  met ? "bg-gradient-to-t from-lime-600 to-lime-300 shadow-[0_0_14px_-2px_rgba(47,123,255,0.5)]" : "bg-white/15",
                  pending && "opacity-60 [background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.12)_0_4px,transparent_4px_8px)]",
                )}
              />
              <span className="absolute -bottom-[22px] left-1/2 -translate-x-1/2 font-mono text-[9.5px] text-white/35">
                {new Date(`${d.day}T00:00:00Z`).getUTCDate()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
