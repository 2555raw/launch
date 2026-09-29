"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function DocsToc({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    items.forEach((i) => {
      const el = document.getElementById(i.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" className="lg:sticky lg:top-24">
      <p className="label">On this page</p>
      <ul className="mt-4 space-y-1 border-l border-line">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              aria-current={active === i.id ? "true" : undefined}
              className={cn(
                "-ml-px block border-l py-1.5 pl-4 text-sm transition-colors",
                active === i.id ? "border-ember text-bone" : "border-transparent text-mute hover:text-fog",
              )}
            >
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
