"use client";

import { useState } from "react";
import { Icon } from "./Icons";

/** Copy to clipboard with a visible, non-blocking confirmation. */
export function Copyable({ value, label, className = "" }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
      className={`inline-flex items-center gap-1.5 text-[12.5px] text-muted transition-colors hover:text-ink ${className}`}
      aria-label={`Copy ${label ?? "value"}`}
    >
      {copied ? <Icon.check className="h-3.5 w-3.5 text-positive" /> : <Icon.copy className="h-3.5 w-3.5" />}
      <span aria-live="polite">{copied ? "Copied" : label ?? "Copy"}</span>
    </button>
  );
}
