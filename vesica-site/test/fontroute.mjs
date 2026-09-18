// Serve Google Fonts from a local mirror. This browser cannot verify the egress
// proxy's CA, so a real request silently falls back to a system font and every
// screenshot becomes a lie about the type. Both the stylesheet and the woff2
// files are fulfilled from disk.
import { readFileSync } from 'fs';
const DIR = '/tmp/claude-0/-home-user-launch/01eb0213-fd9a-5801-9a5f-ac96f868c8ad/scratchpad/gf';
const MAP = JSON.parse(readFileSync(DIR + '/map.json', 'utf8'));
export async function useLocalFonts(page) {
  await page.route('https://fonts.googleapis.com/**', route => {
    const key = MAP.css[route.request().url()];
    if (!key) return route.abort();
    route.fulfill({ contentType: 'text/css', body: readFileSync(`${DIR}/${key}`, 'utf8') });
  });
  await page.route('https://fonts.gstatic.com/**', route => {
    const file = MAP.fonts[route.request().url()];
    if (!file) return route.abort();
    route.fulfill({
      contentType: 'font/woff2',
      headers: { 'access-control-allow-origin': '*' },
      body: readFileSync(`${DIR}/${file}`),
    });
  });
}
