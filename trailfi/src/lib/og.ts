import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { markTileSvg } from "./brand";

/** Shared pieces of the generated link-preview images. */
export const OG_SIZE = { width: 1200, height: 630 };

export const OG_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(markTileSvg(64))}`;

const fontDir = path.join(process.cwd(), "node_modules", "@fontsource", "space-grotesk", "files");

/** Space Grotesk 500 and 700 (the site's display font) the ETH logo and the forest photo as data URLs. */
export async function ogAssets() {
  const [bold, medium, eth, forest] = await Promise.all([
    readFile(path.join(fontDir, "space-grotesk-latin-700-normal.woff")),
    readFile(path.join(fontDir, "space-grotesk-latin-500-normal.woff")),
    readFile(path.join(process.cwd(), "public", "tokens", "eth.png")),
    readFile(path.join(process.cwd(), "public", "images", "og-forest.jpg")),
  ]);
  return {
    eth: `data:image/png;base64,${eth.toString("base64")}`,
    forest: `data:image/jpeg;base64,${forest.toString("base64")}`,
    fonts: [
      { name: "Space Grotesk", data: bold, weight: 700 as const, style: "normal" as const },
      { name: "Space Grotesk", data: medium, weight: 500 as const, style: "normal" as const },
    ],
  };
}
