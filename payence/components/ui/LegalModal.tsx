"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LEGAL_DOCS, type LegalDoc } from "@/lib/legal";

type DocId = LegalDoc["id"];

/**
 * The Terms and Privacy dialogs. Both documents are always in the document and
 * hidden when closed — so they are readable without JavaScript, indexable, and
 * the flat snapshot can open them with nothing but a class toggle.
 */
export function LegalDialogs() {
  const [open, setOpen] = useState<DocId | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(null);
    opener.current?.focus();
    opener.current = null;
  }, []);

  // Any element with data-legal="terms" | "privacy" opens the matching dialog,
  // so links can live anywhere on the page without wiring.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-legal]");
      if (!el) return;
      e.preventDefault();
      opener.current = el;
      setOpen(el.dataset.legal as DocId);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close]);

  return (
    <>
      {(Object.keys(LEGAL_DOCS) as DocId[]).map((id) => {
        const doc = LEGAL_DOCS[id];
        return (
          <div
            key={id}
            id={`legal-${id}`}
            data-legal-panel={id}
            hidden={open !== id}
            className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
          >
            <button
              type="button"
              aria-label="Close"
              data-legal-close
              onClick={close}
              className="absolute inset-0 h-full w-full cursor-default bg-ink/55 backdrop-blur-[2px]"
            />
            <div
              ref={open === id ? dialogRef : undefined}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`legal-${id}-title`}
              tabIndex={-1}
              className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-card border border-hairStrong bg-canvas sm:rounded-card"
            >
              <div className="flex items-start justify-between gap-6 border-b border-hair px-6 py-5 md:px-8">
                <div>
                  <h2 id={`legal-${id}-title`} className="text-[22px] font-bold tracking-tight">
                    {doc.title}
                  </h2>
                  <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                    {doc.updated}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  data-legal-close
                  aria-label="Close"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border border-hairStrong transition-colors duration-200 hover:border-ink"
                >
                  <span className="relative block h-3.5 w-3.5 rotate-45" aria-hidden>
                    <i className="absolute left-0 top-1/2 block h-px w-3.5 -translate-y-1/2 bg-ink" />
                    <i className="absolute left-1/2 top-0 block h-3.5 w-px -translate-x-1/2 bg-ink" />
                  </span>
                </button>
              </div>

              <div className="overflow-y-auto px-6 py-7 md:px-8">
                <p className="rounded-card border border-hair bg-shell px-4 py-3 font-mono text-[11.5px] leading-relaxed text-muted">
                  Template copy for a fictional product. Not legal advice — replace it with text
                  reviewed by counsel before launch.
                </p>

                <p className="mt-7 max-w-[62ch] text-[15px] leading-[1.7] text-muted">{doc.intro}</p>

                <div className="mt-9 space-y-8">
                  {doc.sections.map((s) => (
                    <section key={s.heading}>
                      <h3 className="text-[15px] font-semibold tracking-tight">{s.heading}</h3>
                      {s.body.map((para, i) => (
                        <p
                          key={i}
                          className="mt-3 max-w-[64ch] text-[14.5px] leading-[1.75] text-muted"
                        >
                          {para}
                        </p>
                      ))}
                    </section>
                  ))}
                </div>
              </div>

              <div className="border-t border-hair px-6 py-4 md:px-8">
                <button
                  type="button"
                  onClick={close}
                  data-legal-close
                  className="inline-flex h-10 items-center rounded-pill bg-ink px-5 text-[14px] font-medium text-canvas transition-colors duration-200 hover:bg-coral"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
