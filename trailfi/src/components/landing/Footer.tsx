import Link from "next/link";
import { Logo } from "@/components/Logo";

const LINKS = [
  { href: "/about", label: "About Stepit" },
  { href: "/docs", label: "Documentation" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/contact", label: "Contact" },
];

export function Footer() {
  return (
    <footer className="relative border-t border-white/10 bg-ink-950">
      <div className="container py-14">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-start">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              Walk. Explore. Earn. Stepit rewards verified real-world activity with a share of the $STEPIT token&apos;s
              trading fees, paid to your wallet.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-10 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-8" aria-label="Footer">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-white/65 transition hover:text-lime-300">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hairline my-10" />
        <p className="text-xs text-white/35">© {new Date().getFullYear()} Stepit. Rewards are variable, subject to review, and not guaranteed. Not financial advice.</p>
      </div>
    </footer>
  );
}
