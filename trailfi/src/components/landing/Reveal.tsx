"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

export function Reveal({ delay = 0, y = 24, ...rest }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      {...rest}
    />
  );
}

export function SectionHeading({
  index,
  label,
  title,
  accent,
  children,
  center,
}: {
  index: string;
  label: string;
  title: string;
  accent?: string;
  children?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <Reveal className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <div className={`mb-5 flex items-center gap-3 ${center ? "justify-center" : ""}`}>
        <span className="font-mono text-[11px] text-lime-400">{index}</span>
        <span className="label">{label}</span>
      </div>
      <h2 className="font-display text-4xl font-bold leading-[1.02] tracking-[-0.02em] sm:text-5xl lg:text-[56px]">
        {title}
        {accent && (
          <>
            {" "}
            <span className="text-white/40">{accent}</span>
          </>
        )}
      </h2>
      {children && <p className="mt-5 text-[17px] leading-relaxed text-white/60">{children}</p>}
    </Reveal>
  );
}
