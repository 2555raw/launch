export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer data-nav-ink className="bg-ink pb-10 pt-16 text-canvas">
      <div className="shell">
        <div className="grid grid-cols-2 gap-10 border-t border-hairDark pt-12 md:grid-cols-[1.8fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <p className="text-[19px] font-extrabold tracking-[-0.04em]">NEXORA</p>
            <p className="mt-4 max-w-[32ch] text-[13.5px] leading-relaxed text-canvas/55">
              The financial layer for AI agents: cards, policies and settlement in one platform.
            </p>
          </div>

          <nav aria-label="Elsewhere">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-canvas/40">
              Elsewhere
            </h2>
            <ul className="mt-5 space-y-3">
              <li>
                <a
                  href="#top"
                  className="text-[14px] text-canvas/70 transition-colors duration-200 hover:text-coral"
                >
                  Twitter / X
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Legal">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-canvas/40">
              Legal
            </h2>
            <ul className="mt-5 space-y-3">
              <li>
                <button
                  type="button"
                  data-legal="terms"
                  aria-haspopup="dialog"
                  className="text-[14px] text-canvas/70 transition-colors duration-200 hover:text-coral"
                >
                  Terms
                </button>
              </li>
              <li>
                <button
                  type="button"
                  data-legal="privacy"
                  aria-haspopup="dialog"
                  className="text-[14px] text-canvas/70 transition-colors duration-200 hover:text-coral"
                >
                  Privacy
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-hairDark pt-7 md:flex-row md:items-center md:justify-between">
          <p className="font-mono text-[11px] leading-relaxed text-canvas/40">
            © {year} Nexora Technologies. All rights reserved. Sample figures throughout.
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px] text-canvas/40">
            <li>
              <button
                type="button"
                data-legal="terms"
                aria-haspopup="dialog"
                className="transition-colors duration-200 hover:text-coral"
              >
                Terms of Service
              </button>
            </li>
            <li aria-hidden>·</li>
            <li>
              <button
                type="button"
                data-legal="privacy"
                aria-haspopup="dialog"
                className="transition-colors duration-200 hover:text-coral"
              >
                Privacy Policy
              </button>
            </li>
            <li aria-hidden>·</li>
            <li>Built for machines that pay</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
