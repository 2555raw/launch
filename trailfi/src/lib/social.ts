/** The Strydo token contract address shown on the home page. Empty hides it; the admin setting overrides it. */
export const PROJECT_CA = "";

/** An X post composer link for walkers sharing their own steps or payouts. */
export function xIntent(text: string, url: string) {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}
