// Renders tools/og.html into assets/og-home.jpg and assets/og-verify.jpg.
//   python3 -m http.server 8766   (from obscura-site/)
//   node tools/render-og.mjs
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT || "playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.BASE || "http://localhost:8766/";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const card of ["home", "verify"]) {
  await page.goto(`${base}tools/og.html?card=${card}`);
  await page.waitForFunction(() => window.READY === true);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: join(root, "assets", `og-${card}.jpg`), type: "jpeg", quality: 85 });
  console.log(`assets/og-${card}.jpg`);
}
await browser.close();
