"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SNAPSHOT } from "@/lib/snapshot";

/**
 * A figure that counts to its value when it reaches the viewport.
 *
 * The final value is what renders on the server, so the number is correct with
 * no JavaScript and correct in the flat snapshot; the client resets it before
 * the first paint, which is why this uses a layout effect rather than an
 * ordinary one. An effect would let the final value flash first.
 */
export function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1400,
  className = "",
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const format = (n: number) =>
    prefix +
    n.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) +
    suffix;

  const [text, setText] = useState(() => format(to));
  const ref = useRef<HTMLSpanElement>(null);
  const ran = useRef(SNAPSHOT);

  useLayoutEffect(() => {
    if (ran.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ran.current = true;
      return;
    }
    setText(format(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ran.current || !ref.current) return;
    const el = ref.current;

    const run = () => {
      ran.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // ease-out: fast first, settles on the number
        const eased = 1 - Math.pow(1 - t, 3);
        setText(format(to * eased));
        if (t < 1) requestAnimationFrame(tick);
        else setText(format(to));
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          run();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, duration]);

  return (
    <span
      ref={ref}
      data-countup={to}
      data-countup-format={JSON.stringify({ decimals, prefix, suffix })}
      className={`tnum ${className}`}
    >
      {text}
    </span>
  );
}
