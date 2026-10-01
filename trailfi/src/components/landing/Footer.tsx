"use client";

import { ArrowRight, Globe2, Link2, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { LogoMark } from "@/components/Logo";
import { api } from "@/lib/fetcher";

const COLUMNS = [
  {
    title: "Stepit",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#rewards", label: "Rewards" },
      { href: "/#leaderboard", label: "Payouts" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Walkers",
    links: [
      { href: "/steps", label: "Upload steps" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/docs", label: "Documentation" },
    ],
  },
  {
    title: "Help & Support",
    links: [
      { href: "/about", label: "About Stepit" },
      { href: "/contact", label: "Contact us" },
      { href: "/#faq", label: "FAQs" },
    ],
  },
];

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "helloStepIT@outlook.com";

/** X always shows; the other profiles get an icon once their link is configured. */
const SOCIALS = [
  { label: "X", href: process.env.NEXT_PUBLIC_X_URL || "https://x.com", icon: XIcon },
  { label: "Telegram", href: process.env.NEXT_PUBLIC_TELEGRAM_URL, icon: TelegramIcon },
  { label: "Instagram", href: process.env.NEXT_PUBLIC_INSTAGRAM_URL, icon: InstagramIcon },
  { label: "Discord", href: process.env.NEXT_PUBLIC_DISCORD_URL, icon: DiscordIcon },
].filter((s): s is typeof s & { href: string } => Boolean(s.href));

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.06] bg-ink-950 text-white">
      {/* Paper grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="container relative pt-20 sm:pt-24">
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 lg:grid-cols-[1.35fr_1fr_1fr_1.1fr_1.45fr] lg:gap-10">
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-3" aria-label="Stepit home">
              <LogoMark className="h-11 w-11" />
              <span className="font-display text-[34px] font-bold leading-none tracking-tight">
                Step<span className="text-lime-400">it</span>
              </span>
            </Link>
            <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-white/60">
              Every step counts. Walk the trail, earn from the token, keep what you make.
            </p>
            <ul className="mt-6 space-y-3 text-[14.5px] text-white/75">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 transition hover:text-lime-300">
                  <Mail className="h-[17px] w-[17px] shrink-0 text-lime-400" strokeWidth={1.5} /> {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <a
                  href="https://robinhood.com/us/en/crypto/chain/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 transition hover:text-lime-300"
                >
                  <Link2 className="h-[17px] w-[17px] shrink-0 text-lime-400" strokeWidth={1.5} /> Built on Robinhood Chain
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Globe2 className="h-[17px] w-[17px] shrink-0 text-lime-400" strokeWidth={1.5} /> Walk anywhere in the world
              </li>
            </ul>
            {SOCIALS.length > 0 && (
              <div className="mt-8 flex items-center gap-6">
                {SOCIALS.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} className="text-lime-400 transition hover:text-lime-300">
                    <s.icon />
                  </a>
                ))}
              </div>
            )}
          </div>

          {COLUMNS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <FooterHeading>{c.title}</FooterHeading>
              <ul className="mt-6 space-y-3">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-[15px] text-white/70 transition hover:text-lime-300">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="col-span-2 lg:col-span-1">
            <FooterHeading>Newsletter</FooterHeading>
            <p className="mt-6 text-[15px] leading-relaxed text-white/60">
              Subscribe for launch news, new trails and payout updates.
            </p>
            <NewsletterForm />
          </div>
        </div>

        <div className="relative z-10 mt-14 flex flex-col-reverse gap-4 text-[13.5px] sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-xs leading-relaxed text-white/40">
            © {new Date().getFullYear()} Stepit. Rewards are variable, reviewed before payment and never guaranteed. Not
            financial advice.
          </p>
          <nav className="flex items-center gap-4 text-white/85" aria-label="Legal">
            <Link href="/privacy" className="transition hover:text-lime-300">
              Privacy Policy
            </Link>
            <span className="text-lime-400/60">|</span>
            <Link href="/terms" className="transition hover:text-lime-300">
              Terms of Service
            </Link>
            <span className="text-lime-400/60">|</span>
            <Link href="/contact" className="transition hover:text-lime-300">
              Contact
            </Link>
          </nav>
        </div>
      </div>

      {/* Engraved landscape: two hikers crossing below the range */}
      <div className="pointer-events-none relative -mt-[9%] aspect-[1600/520] min-h-[260px] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/footer-trail.svg"
          alt="Two hikers with backpacks and trekking poles crossing a grassland below the mountains"
          className="absolute inset-0 h-full w-full object-cover object-[50%_100%]"
          loading="lazy"
        />
      </div>
    </footer>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-[13px] font-semibold uppercase tracking-[0.18em] text-white">{children}</h3>
      <span className="mt-4 block h-px w-10 bg-lime-400" />
    </div>
  );
}

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <form
      className="mt-6 flex"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/api/newsletter", { method: "POST", json: { email } });
          setDone(true);
          setEmail("");
          toast.success("You're on the list", { description: "We'll write when there's news on the trail." });
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="sr-only" htmlFor="newsletter-email">
        Email
      </label>
      <input
        id="newsletter-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={done ? "Thanks for subscribing" : "Enter your email"}
        className="h-12 min-w-0 flex-1 rounded-l-xl border border-r-0 border-white/15 bg-black/30 px-4 text-sm text-white placeholder:text-white/35 focus:border-lime-400/60 focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy}
        aria-label="Subscribe"
        className="grid h-12 w-12 shrink-0 place-items-center rounded-r-xl bg-lime-400 text-ink-950 transition hover:bg-lime-300 disabled:opacity-60"
      >
        <ArrowRight className="h-5 w-5" strokeWidth={1.5} />
      </button>
    </form>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.2h1.7L7.4 4.7H5.57l11.1 14.5Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M21.94 4.3 18.8 19.12c-.24 1.05-.86 1.31-1.74.82l-4.8-3.54-2.32 2.23c-.26.26-.47.47-.97.47l.35-4.9 8.93-8.07c.39-.35-.08-.54-.6-.19L6.62 12.9l-4.75-1.49c-1.03-.32-1.05-1.03.22-1.53L20.66 2.7c.86-.32 1.61.2 1.28 1.6Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M19.3 5.34A16.6 16.6 0 0 0 15.2 4l-.2.4a15.3 15.3 0 0 1 3.66 1.67 12.6 12.6 0 0 0-13.3 0A15.3 15.3 0 0 1 9 4.4L8.8 4a16.6 16.6 0 0 0-4.1 1.34C2.1 9.2 1.4 12.95 1.75 16.65A16.7 16.7 0 0 0 6.8 19.2l1.08-1.48a10.8 10.8 0 0 1-1.7-.82l.42-.33a11.9 11.9 0 0 0 10.8 0l.42.33c-.54.32-1.11.6-1.7.82l1.08 1.48a16.7 16.7 0 0 0 5.05-2.55c.42-4.29-.7-8-2.95-11.31ZM8.68 14.38c-1 0-1.82-.92-1.82-2.05 0-1.13.8-2.05 1.82-2.05s1.84.93 1.82 2.05c0 1.13-.8 2.05-1.82 2.05Zm6.64 0c-1 0-1.82-.92-1.82-2.05 0-1.13.8-2.05 1.82-2.05s1.84.93 1.82 2.05c0 1.13-.8 2.05-1.82 2.05Z" />
    </svg>
  );
}
