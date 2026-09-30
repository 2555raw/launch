"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  prefix = "",
  suffix,
  decimals = 2,
  hint,
  icon: Icon,
  accent,
  delay = 0,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  hint?: string;
  icon: LucideIcon;
  accent?: boolean;
  delay?: number;
}) {
  const v = useCountUp(value, 1200);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={cn(
        "group relative overflow-hidden rounded-3xl border p-5 transition duration-300 hover:-translate-y-0.5",
        accent ? "border-lime-400/25 bg-lime-400/[0.06] hover:border-lime-400/40" : "glass hover:border-white/20",
      )}
    >
      {accent && <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-lime-400/20 blur-2xl" />}
      <div className="flex items-center justify-between">
        <span className="label !text-[10px]">{label}</span>
        <span className={cn("grid h-8 w-8 place-items-center rounded-xl", accent ? "bg-lime-400/15 text-lime-300" : "bg-white/5 text-white/50")}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className={cn("mt-4 font-display text-[28px] font-bold leading-none tracking-tight tabular", accent && "text-lime-300")}>
        {prefix}
        {v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
        {suffix && <span className="ml-1.5 text-sm font-medium text-white/40">{suffix}</span>}
      </div>
      {hint && <div className="mt-2 text-[12px] text-white/45">{hint}</div>}
    </motion.div>
  );
}
