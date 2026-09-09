"use client";

import { useEffect, useState } from "react";
import { getConsent, setConsent } from "@/lib/consent";

/**
 * The consent notice, bottom-left, on arrival. It asks for one thing and says
 * exactly what that thing is — and the thing is real: allow it and the card you
 * design in the hero is still yours when you come back.
 */
export function CookieNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (getConsent() === null) setOpen(true);
  }, []);

  const answer = (value: "allowed" | "declined") => {
    setConsent(value);
    setOpen(false);
    window.dispatchEvent(new CustomEvent("payence:consent", { detail: value }));
  };

  return (
    <div
      data-cookie-notice
      hidden={!open}
      role="dialog"
      aria-label="Cookie notice"
      className="fixed bottom-5 left-5 right-5 z-[70] ml-auto max-w-[380px] rounded-[18px] border border-hair bg-canvas p-6 shadow-[0_28px_60px_-32px_rgba(21,21,21,0.55)] sm:left-auto"
    >
      <h2 className="text-[17px] font-bold tracking-tight">A small cookie?</h2>
      <p className="mt-3 text-[13.5px] leading-[1.65] text-muted">
        Payence can keep one first-party entry in this browser that remembers the card you design
        here — its name, colour and network — so your card is still yours when you come back. No
        analytics, no third parties, nothing leaves this browser.
      </p>
      <div className="mt-5 flex gap-2.5">
        <button
          type="button"
          data-cookie-decline
          onClick={() => answer("declined")}
          className="h-10 flex-1 rounded-pill border border-hairStrong text-[13.5px] font-medium transition-colors duration-200 hover:border-ink"
        >
          No thanks
        </button>
        <button
          type="button"
          data-cookie-allow
          onClick={() => answer("allowed")}
          className="h-10 flex-1 rounded-pill bg-ink text-[13.5px] font-medium text-canvas transition-colors duration-200 hover:bg-coral"
        >
          Allow
        </button>
      </div>
    </div>
  );
}
