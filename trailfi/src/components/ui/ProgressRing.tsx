"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function ProgressRing({
  value,
  size = 160,
  stroke = 12,
  children,
  id = "ring",
}: {
  /** 0..1 (values above 1 are shown as a full ring). */
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  id?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d8ff9c" />
            <stop offset="60%" stopColor="#b2f047" />
            <stop offset="100%" stopColor="#5dff9d" />
          </linearGradient>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={1}
          fill="none"
          strokeDasharray="2 6"
          transform={`translate(0 0)`}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id}-grad)`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          filter={`url(#${id}-glow)`}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
