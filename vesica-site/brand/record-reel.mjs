/* Records brand/reel.html — the forty-second explainer — to a webm, which
   ffmpeg then turns into the mp4 X wants:

     node record-reel.mjs
     ffmpeg -i vid2/*.webm -vf "scale=1280:720:flags=lanczos,fps=30" \
            -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
            -movflags +faststart -an vesica-reel.mp4

   The site has to be served at 127.0.0.1:8931 and the fonts mirrored
   locally (fontroute.mjs), or the type in the recording is not the type
   on the site. */

import { chromium } from 'playwright-core';
import { useLocalFonts } from './fontroute.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 },
  recordVideo: { dir: './vid2', size: { width: 1280, height: 720 } } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await useLocalFonts(p);
await p.goto('http://127.0.0.1:8931/brand/reel.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(41500);
console.log('errors:', errs.length ? errs : 'none');
await ctx.close(); await b.close();
