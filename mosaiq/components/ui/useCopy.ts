"use client";

import { useCallback, useRef, useState } from "react";

/** Copy text to the clipboard and remember which thing was copied for ~1.6s. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const copy = useCallback(async (text: string, id = "default") => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API blocked (insecure origin, permissions): fall back to a hidden textarea.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      if (!ok) return false;
    }
    setCopied(id);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1600);
    return true;
  }, []);

  return { copied, copy };
}
