"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Reveal } from "../ui/Reveal";

export function Statement() {
  const ref = useRef<HTMLElement>(null);
  const still = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  // The rule drifts across as the section passes: the only decorative motion here.
  const x = useTransform(scrollYProgress, [0, 1], ["-14%", still ? "-14%" : "6%"]);

  return (
    <section ref={ref} className="relative overflow-hidden border-t border-hair py-32 md:py-48">
      <motion.span
        aria-hidden
        style={{ x }}
        className="pointer-events-none absolute left-0 top-1/2 hidden h-px w-[130%] bg-hair md:block"
      />
      <div className="shell relative">
        <Reveal>
          <h2 className="max-w-[15ch] text-mega font-extrabold">
            AI agents shouldn&apos;t stop at the{" "}
            <span className="text-coral">payment screen.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-12 max-w-[42ch] text-[17px] leading-[1.65] text-muted md:ml-auto md:mt-16 md:text-[19px]">
            Give autonomous systems the financial infrastructure they need to complete the work.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
