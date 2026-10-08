// Renders tools/social.html into assets/social/: header.png (1500x500, for X)
// and pfp-blue.png / pfp-white.png (1000x1000), all at 2x pixel density.
//   python3 -m http.server 8766   (from obscura-site/)
//   BASE=http://localhost:8766/ node tools/render-social.mjs
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.BASE || "http://localhost:8766/";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
for (const [asset, w, h, scale] of [["header", 1500, 500, 2], ["pfp-blue", 1000, 1000, 1], ["pfp-white", 1000, 1000, 1]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await page.goto(`${base}tools/social.html?asset=${asset}`);
  await page.waitForFunction(() => window.READY === true);
  await page.screenshot({ path: join(root, "assets", "social", `${asset}.png`) });
  console.log(`assets/social/${asset}.png`);
  await page.close();
}
await browser.close();
