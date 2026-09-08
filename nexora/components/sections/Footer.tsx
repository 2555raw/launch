const COLUMNS = [
  {
    title: "Platform",
    links: ["Product", "Developers", "Security", "Documentation"],
  },
  {
    title: "Elsewhere",
    links: ["Twitter / X", "GitHub"],
  },
  {
    title: "Legal",
    links: ["Terms", "Privacy"],
  },
];

export function Footer() {
  return (
    <footer data-nav-ink className="bg-ink pb-12 pt-16 text-canvas">
      <div className="shell">
        <div className="grid grid-cols-2 gap-10 border-t border-hairDark pt-12 md:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div className="col-span-2 md:col-span-1">
            <p className="text-[19px] font-extrabold tracking-[-0.04em]">NEXORA</p>
            <p className="mt-4 max-w-[30ch] text-[13.5px] leading-relaxed text-canvas/55">
              The financial layer for AI agents: cards, policies and settlement in one platform.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-canvas/40">
                {col.title}
              </h2>
              <ul className="mt-5 space-y-3">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#top"
                      className="text-[14px] text-canvas/70 transition-colors duration-200 hover:text-coral"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-hairDark pt-7">
          <p className="font-mono text-[11px] text-canvas/40">
            © {new Date().getFullYear()} Nexora · Sample figures throughout
          </p>
          <p className="font-mono text-[11px] text-canvas/40">Built for machines that pay</p>
        </div>
      </div>
    </footer>
  );
}
