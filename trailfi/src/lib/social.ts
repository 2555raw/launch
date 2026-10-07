/** Stepit's public profiles. */
export const X_HANDLE = "HelloStepit";
/** The Stepit token contract address shown on the home page. Empty hides it; the admin setting overrides it. */
export const PROJECT_CA = "";
export const X_URL = process.env.NEXT_PUBLIC_X_URL || `https://x.com/${X_HANDLE}`;

/** An X post composer link, credited to the Stepit account. */
export function xIntent(text: string, url: string) {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&via=${X_HANDLE}`;
}
