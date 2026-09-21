import Link from "next/link";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Personal",
    links: [
      { href: "/signup", label: "Create an account" },
      { href: "/#how", label: "How payments work" },
      { href: "/#fees", label: "Fees" },
      { href: "/#faq", label: "Questions" },
    ],
  },
  {
    title: "Business",
    links: [
      { href: "/merchant", label: "Accept payments" },
      { href: "/developers", label: "Developers" },
      { href: "/developers/api", label: "API reference" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Terms of Service" },
      { href: "/legal/privacy", label: "Privacy Policy" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-hair bg-shell py-14">
      <div className="shell">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <p className="text-[19px] font-extrabold tracking-[-0.045em]">PAYENCE</p>
            <p className="mt-3 max-w-[30ch] text-[13.5px] leading-relaxed text-muted">
              Stablecoin payments that feel like a card. Hold digital euros and dollars, pay anywhere Payence is taken.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-[12px] uppercase tracking-[0.1em] text-muted">{col.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[13.5px] text-ink/80 transition-colors hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 space-y-3 border-t border-hair pt-7 text-[12px] leading-relaxed text-muted">
          <p>
            <strong className="font-semibold text-ink">Payence is a demonstration build, not a licensed payment
            institution.</strong>{" "}
            It is not authorised by any financial regulator, holds no e-money or payment services licence, and must not
            be used to move real customer funds. Stablecoins are not bank deposits and are not covered by a deposit
            guarantee scheme.
          </p>
          <p>© {new Date().getFullYear()} Payence. Built as a working reference for stablecoin payment infrastructure.</p>
        </div>
      </div>
    </footer>
  );
}
