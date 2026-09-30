/**
 * Brand and site configuration. Renaming the product starts here: every
 * visible mention of the name, the SEO metadata, the OG image and the footer
 * read from this object.
 */
export const site = {
  name: "Picker",
  tagline: "Every pad. Your pick.",
  description:
    "Picker puts every token launchpad on Robinhood Chain, Solana, BNB Chain and Arc in one place. Pick your pad, draft the token, and your agent places the launch.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  /** Set the X account here once it exists; while null, X links are hidden. */
  social: {
    x: null as { handle: string; url: string } | null,
  },
  keyPrefix: "pk_live_",
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
