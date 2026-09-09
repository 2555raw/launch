"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * A budget bar. It fills once, when it comes into view, to the value it is
 * actually reporting. The animation is the number, not decoration.
 */
export function Meter({
  value,
  tone = "coral",
  className = "",
  delay = 0,
}: {
  value: number;
  tone?: "coral" | "violet" | "positive" | "ink";
  className?: string;
  delay?: number;
}) {
  const still = useReducedMotion();
  const fill = {
    coral: "bg-coral",
    violet: "bg-violet",
    positive: "bg-positive",
    ink: "bg-ink",
  }[tone];

  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-pill bg-ink/10 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.i
        className={`block h-full rounded-pill ${fill}`}
        initial={still ? false : { width: 0 }}
        whileInView={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        viewport={{ once: true, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 1.05, delay, ease: [0.22, 0.65, 0.3, 1] }}
      />
    </div>
  );
}
