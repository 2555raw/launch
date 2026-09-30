"use client";

import { useEffect, useRef, useState } from "react";

/** Animates a number from its previous value to `target` (ease-out cubic). */
export function useCountUp(target: number, duration = 1400, start = true) {
  const [value, setValue] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (!start) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(target);
      from.current = target;
      return;
    }
    const begin = performance.now();
    const initial = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - begin) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(initial + (target - initial) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);

  return value;
}
