/**
 * Brand and site configuration. Renaming the product starts here: every
 * visible mention of the name, the SEO metadata, the OG image and the footer
 * read from this object.
 */
export const site = {
  name: "PadPicker",
  tagline: "Every pad. Your pick.",
  description:
    "PadPicker puts every token launchpad on Robinhood Chain, Solana, BNB Chain and Arc in one place. Pick your pad, draft the token, and your agent places the launch.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  social: {
    x: { handle: "@padpicker", url: "https://x.com/padpicker" },
  },
  keyPrefix: "pp_live_",
} as const;

export const nav = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/launch", label: "Launch" },
  { href: "/analytics", label: "Analytics" },
  { href: "/docs", label: "Docs" },
] as const;

export const legalPages = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/disclosures", label: "Disclosures" },
] as const;
