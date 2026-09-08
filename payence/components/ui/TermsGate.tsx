"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GATE_TERMS } from "@/lib/legal";

type Status = "idle" | "open" | "accepted" | "declined";

const KEY = "payence-terms";
/** How far down the page the visitor gets before being asked. */
const TRIGGER_PX = 520;

/**
 * The terms gate.
 *
 * It does not interrupt the first frame: the visitor reads the hero, and the
 * dialog arrives once they have scrolled far enough to be actually using the
 * page. Accepting is remembered, so it asks once and not on every visit.
 * Declining closes the site behind a screen that always offers the way back —
 * a gate that can lock someone out permanently is a bug, not a policy.
 */
export function TermsGate() {
  const [status, setStatus] = useState<Status>("idle");
  const dialogRef = useRef<HTMLDivElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);

  // A previous acceptance skips the gate entirely.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch (_) {
      /* storage blocked — ask again this visit */
    }
    if (stored === "accepted") {
      setStatus("accepted");
      return;
    }

    const onScroll = () => {
      if (window.scrollY < TRIGGER_PX) return;
      setStatus((s) => (s === "idle" ? "open" : s));
      window.removeEventListener("scroll", onScroll);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const blocking = status === "open" || status === "declined";

  // While the gate is up the page behind must not scroll or take focus.
  useEffect(() => {
    if (!blocking) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [blocking]);

  useEffect(() => {
    if (status !== "open") return;
    acceptRef.current?.focus();

    // Escape and clicks outside deliberately do nothing: this is a choice, not a
    // dismissal. Tab is kept inside the dialog.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [status]);

  const accept = useCallback(() => {
    try {
      localStorage.setItem(KEY, "accepted");
    } catch (_) {
      /* storage blocked — it will ask again next visit */
    }
    setStatus("accepted");
  }, []);

  return (
    <>
      {/* the dialog */}
      <div
        data-terms-gate
        hidden={status !== "open"}
        className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6"
      >
        {/* the page stays legible through the scrim: dimmed, not covered */}
        <div
          aria-hidden
          className="absolute inset-0 bg-ink/45 backdrop-blur-[3px] backdrop-saturate-150"
        />

        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="terms-gate-title"
          aria-describedby="terms-gate-body"
          className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[20px] border border-hairStrong bg-canvas shadow-[0_40px_80px_-40px_rgba(21,21,21,0.7)] sm:rounded-[20px]"
        >
          <div className="border-b border-hair px-7 pb-5 pt-7 md:px-9">
            <h2 id="terms-gate-title" className="text-[26px] font-extrabold tracking-[-0.03em]">
              Terms and conditions
            </h2>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Please accept to continue
            </p>
          </div>

          <div id="terms-gate-body" className="overflow-y-auto px-7 py-6 md:px-9">
            <p className="rounded-card border border-hair bg-shell px-4 py-3 font-mono text-[11.5px] leading-relaxed text-muted">
              Template copy for a fictional product. Not legal advice — replace it with text
              reviewed by counsel before launch.
            </p>

            <div className="mt-7 space-y-6">
              {GATE_TERMS.map((s) => (
                <section key={s.heading}>
                  <h3 className="text-[14.5px] font-semibold tracking-tight">{s.heading}</h3>
                  <p className="mt-2 max-w-[64ch] text-[14px] leading-[1.7] text-muted">{s.body}</p>
                </section>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hair px-7 py-5 md:px-9">
            <button
              type="button"
              data-terms-print
              onClick={() => window.print()}
              className="h-11 rounded-pill border border-hairStrong px-5 text-[14px] font-medium transition-colors duration-200 hover:border-ink"
            >
              Print
            </button>

            <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
              <button
                ref={acceptRef}
                type="button"
                data-terms-accept
                onClick={accept}
                className="h-11 min-w-[132px] rounded-pill bg-coral px-6 text-[14px] font-semibold text-canvas transition-transform duration-200 hover:-translate-y-[2px]"
              >
                Accept
              </button>
              <button
                type="button"
                data-terms-decline
                onClick={() => setStatus("declined")}
                className="h-11 min-w-[132px] rounded-pill border border-violet px-6 text-[14px] font-semibold text-violet transition-colors duration-200 hover:bg-violet hover:text-canvas"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* declined: the site closes, and the way back stays open */}
      <div
        data-terms-blocked
        hidden={status !== "declined"}
        className="fixed inset-0 z-[95] flex items-center justify-center bg-canvas px-6"
      >
        <div className="max-w-md text-center">
          <p className="text-[19px] font-extrabold tracking-[-0.04em]">PAYENCE</p>
          <h2 className="mt-8 text-[30px] font-extrabold leading-[1.1] tracking-[-0.035em] md:text-[38px]">
            You declined the terms.
          </h2>
          <p className="mt-5 text-[15.5px] leading-[1.65] text-muted">
            Payence needs your agreement before you can use the site. Nothing was stored, and you
            can accept whenever you like.
          </p>
          <button
            type="button"
            data-terms-review
            onClick={() => setStatus("open")}
            className="mt-9 h-12 rounded-pill bg-ink px-7 text-[14.5px] font-semibold text-canvas transition-colors duration-200 hover:bg-coral"
          >
            Read the terms again
          </button>
        </div>
      </div>
    </>
  );
}
