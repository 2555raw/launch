"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { SNAPSHOT } from "@/lib/snapshot";

type Props = {
  children: ReactNode;
  /** Stagger position within a group, in seconds. */
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
};

/**
 * The one entrance used on the page: a short rise as the element reaches the
 * viewport, once, never on a loop. With reduced motion it renders in place.
 */
export function Reveal({ children, delay = 0, className, as = "div" }: Props) {
  const still = useReducedMotion() || SNAPSHOT;
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      initial={still ? false : { opacity: 0, y: 22 }}
      whileInView={still ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.62, delay, ease: [0.22, 0.65, 0.3, 1] }}
    >
      {children}
    </Tag>
  );
}
