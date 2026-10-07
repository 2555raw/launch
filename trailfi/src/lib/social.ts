/** Strydo's public profiles. */
export const X_HANDLE = "StrydoWalk";
export const X_URL = process.env.NEXT_PUBLIC_X_URL || `https://x.com/${X_HANDLE}`;

/** The Strydo token contract address shown on the home page. Empty hides it; the admin setting overrides it. */
export const PROJECT_CA = "";

/** An X post composer link for walkers sharing their own steps or payouts, credited to the Strydo account. */
export function xIntent(text: string, url: string) {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&via=${X_HANDLE}`;
}
