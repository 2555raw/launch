/**
 * Brand and site configuration. Renaming the product starts here: every
 * visible mention of the name, the SEO metadata, the OG image and the footer
 * read from this object.
 */
export const site = {
  name: "Mosaiq",
  tagline: "Every launchpad. One canvas.",
  description:
    "Mosaiq brings token launchpads on Solana, BNB Chain and Base into a single launch studio. You draft the token, your agent places the launch.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  social: {
    x: { handle: "@mosaiqhq", url: "https://x.com/mosaiqhq" },
  },
  keyPrefix: "mq_live_",
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
