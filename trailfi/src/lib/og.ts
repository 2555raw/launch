import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Shared pieces of the generated link-preview images. */
export const OG_SIZE = { width: 1200, height: 630 };

export const OG_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x=".5" y=".5" width="31" height="31" rx="9.5" fill="#071d14" stroke="#c4fb6d" stroke-opacity=".35"/><g fill="#c4fb6d" opacity=".7"><ellipse cx="11" cy="20.3" rx="2.9" ry="4.3" transform="rotate(-12 11 20.3)"/><circle cx="9.1" cy="14.2" r="1.05"/><circle cx="11.1" cy="13.5" r="1.15"/><circle cx="13" cy="14.1" r=".95"/></g><g fill="#5dff9d"><ellipse cx="20.8" cy="14.6" rx="2.9" ry="4.3" transform="rotate(12 20.8 14.6)"/><circle cx="19.3" cy="8.5" r="1.05"/><circle cx="21.3" cy="7.9" r="1.15"/><circle cx="23.2" cy="8.6" r=".95"/></g></svg>`,
)}`;

const fontDir = path.join(process.cwd(), "node_modules", "@fontsource", "space-grotesk", "files");

/** Space Grotesk 500 and 700 (the site's display font) and the USDG logo as a data URL. */
export async function ogAssets() {
  const [bold, medium, usdg] = await Promise.all([
    readFile(path.join(fontDir, "space-grotesk-latin-700-normal.woff")),
    readFile(path.join(fontDir, "space-grotesk-latin-500-normal.woff")),
    readFile(path.join(process.cwd(), "public", "tokens", "usdg.png")),
  ]);
  return {
    usdg: `data:image/png;base64,${usdg.toString("base64")}`,
    fonts: [
      { name: "Space Grotesk", data: bold, weight: 700 as const, style: "normal" as const },
      { name: "Space Grotesk", data: medium, weight: 500 as const, style: "normal" as const },
    ],
  };
}
