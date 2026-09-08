"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  href?: string;
  variant?: "solid" | "outline" | "ghost" | "invert";
  size?: "sm" | "md" | "lg";
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-medium transition-colors duration-200 whitespace-nowrap";

const variants = {
  solid: "bg-ink text-canvas hover:bg-coral",
  outline: "border border-hairStrong text-ink hover:border-ink hover:bg-ink hover:text-canvas",
  ghost: "text-ink hover:text-coral",
  invert: "bg-canvas text-ink hover:bg-coral hover:text-canvas",
};

const sizes = {
  sm: "h-9 px-4 text-[13px]",
  md: "h-11 px-6 text-[14px]",
  lg: "h-14 px-8 text-[15px]",
};

/** Buttons take the page's only micro-interaction: a small press, no bounce. */
export function Button({
  children,
  href,
  variant = "solid",
  size = "md",
  className = "",
  type = "button",
  onClick,
}: Props) {
  const still = useReducedMotion();
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`;
  const motionProps = still
    ? {}
    : { whileHover: { y: -2 }, whileTap: { y: 0, scale: 0.985 }, transition: { duration: 0.18 } };

  if (href) {
    return (
      <motion.a href={href} className={cls} {...motionProps}>
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button type={type} onClick={onClick} className={cls} {...motionProps}>
      {children}
    </motion.button>
  );
}
