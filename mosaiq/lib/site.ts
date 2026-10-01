/**
 * Brand and site configuration. Renaming the product starts here: every
 * visible mention of the name, the SEO metadata, the OG image and the footer
 * read from this object.
 */
export const site = {
  name: "Chooser",
  tagline: "Every pad. Your choice.",
  description:
    "Chooser puts every token launchpad on Robinhood Chain, Solana, BNB Chain and Arc in one place. Choose your pad, draft the token, and launch it from your wallet or let your agent do it.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  /** Set to null to hide every X link. */
  social: {
    x: null as { handle: string; url: string } | null,
  },
  keyPrefix: "pk_live_",
  /** The Chooser token's contract address, shown in the home hero. Empty hides it; TOKEN_CA overrides it. */
  tokenCa: "",
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
