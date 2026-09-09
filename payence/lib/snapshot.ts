/**
 * Static-snapshot mode.
 *
 * The app ships as a normal Next.js build. When NEXT_PUBLIC_SNAPSHOT=1 it is
 * exported instead as one flat HTML page (for sharing a link to the design),
 * and the two components that mount only their open panel render all of them,
 * with the closed ones hidden. Same markup, same classes; the difference is
 * that everything is in the document, so plain JS can toggle it.
 */
export const SNAPSHOT = process.env.NEXT_PUBLIC_SNAPSHOT === "1";
