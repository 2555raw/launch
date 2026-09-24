/* The rule, held down by checks.
 *
 * Spinpad has exactly one thing it must never get wrong: no coin is launched
 * without a spin, and the pairing is whatever the wheel landed on — the same
 * value on the result screen, in the confirmation and in the bytes that go to
 * the chain. Everything here exercises that in a real browser, including the
 * ways someone would try to go around it from a console.
 *
 * Needs Playwright on the machine, which is deliberately not a dependency of
 * the site — the site itself ships nothing. Run it with:
 *
 *   npm test                       # picks up a global or nearby playwright
 *   CHROME_PATH=/path/to/chrome npm test
 */
const http = require('http');
const zlib = require('zlib');
const path = require('path');
const { spawn } = require('child_process');

const PAGE = 'file://' + path.join(__dirname, '..', 'index.html');

let passed = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
};

/* Wait for a smooth scroll to actually finish.
 *
 * A fixed timeout is a guess, and measuring anything positional mid-flight
 * reads where the page started rather than where it stopped.
 *
 * Counting frames does not work here and the first version of this did. Under
 * a headless browser requestAnimationFrame fires faster than the scroll
 * updates scrollY, so two consecutive frames read the same value in the middle
 * of a scroll that has a second left to run. This is on the clock instead:
 * unchanged for 260ms, and never before 420ms have passed, which covers the
 * pre-roll where a smooth scroll has been asked for but has not started. */
const settle = (page, ms = 260) => page.evaluate((hold) => new Promise((resolve) => {
  const t0 = performance.now();
  let last = window.scrollY, since = t0;
  const tick = (now) => {
    if (window.scrollY !== last) { last = window.scrollY; since = now; }
    if (now - t0 > 420 && now - since > hold) resolve();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), ms);

/* ---------- a large PNG, built here ----------
 *
 * The image field has to be given something big enough that shrinking it is
 * visible, and every picture in the repository is already 128px. Rather than
 * commit a photograph to prove a resize, the suite writes its own: a 900×700
 * gradient, which is a real PNG a browser will decode, and which no code under
 * test has ever seen.
 */
const crc32 = (buf) => {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const bigPng = (w, h) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;                       // 8-bit, truecolour
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 3);
    raw[row] = 0;                                 // filter: none
    for (let x = 0; x < w; x++) {
      const i = row + 1 + x * 3;
      raw[i] = (x * 255 / w) | 0;
      raw[i + 1] = (y * 255 / h) | 0;
      raw[i + 2] = ((x + y) * 255 / (w + h)) | 0;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

/* ---------- the wheel's table, rebuilt here on purpose ----------
 *
 * The pairings themselves are read off config.js: hardcoding sixteen names
 * here would let this pass while the page paired coins with something else.
 * The geometry is not read off anything — it is worked out again from the
 * axes, so if app.js ever changes which node is which cell, the check below
 * that resolves the arrow's resting angle into a pairing fails. */
const sectorsFrom = (cfg) => {
  const out = [];
  cfg.positions.forEach((p, q) => {
    cfg.colours.forEach((_, k) => {
      out.push({ position: p.id, color: cfg.colours[(k + q) % cfg.colours.length].id });
    });
  });
  return out;
};
const assetAt = (cfg, sec) => cfg.pairings[sec.position + '.' + sec.color];
const comboAt = (cfg, sec) => {
  const p = cfg.positions.find((x) => x.id === sec.position);
  const c = cfg.colours.find((x) => x.id === sec.color);
  return p.label.toUpperCase() + ' · ' + c.label.toUpperCase();
};

/* ---------- the server must survive a hostile path ---------- */
const get = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => { res.resume(); resolve(res.statusCode); }).on('error', reject);
});

async function serverChecks() {
  console.log('\nserver');
  const port = 8099;
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port) }, stdio: 'ignore',
  });
  try {
    await new Promise((r) => setTimeout(r, 700));
    const base = 'http://127.0.0.1:' + port;
    ok('serves the page', await get(base + '/') === 200);
    // decodeURIComponent throws URIError on this one
    ok('malformed escape is a 400, not a crash', await get(base + '/%') === 400);
    // a NUL byte makes fs.readFile throw synchronously
    ok('NUL byte is a 400, not a crash', await get(base + '/a%00b') === 400);
    ok('unknown path is a 404', await get(base + '/nope') === 404);
    // traversal in the shapes people actually try
    for (const p of ['/../package.json', '/..%2f..%2fetc%2fpasswd', '/....//etc/passwd', '/%2e%2e/%2e%2e/etc/passwd']) {
      // eslint-disable-next-line no-await-in-loop
      const code = await get(base + p);
      ok('no escape via ' + p, code === 404 || code === 403 || code === 200 && p === '/../package.json',
        'got ' + code);
    }
    ok('still serving after all of that', await get(base + '/') === 200);
  } finally {
    child.kill();
  }
}

/* ---------- the table is one table ---------- */
async function configChecks(cfg) {
  console.log('\nthe table');
  const cells = cfg.positions.length * cfg.colours.length;
  ok('four positions by four colours', cfg.positions.length === 4 && cfg.colours.length === 4);
  const keys = Object.keys(cfg.pairings);
  ok('sixteen pairings, no more', keys.length === cells, keys.length + ' keys');

  let complete = true;
  cfg.positions.forEach((p) => cfg.colours.forEach((c) => {
    const a = cfg.pairings[p.id + '.' + c.id];
    if (!a || !a.name || !a.ticker) complete = false;
  }));
  ok('every position-and-colour reaches an asset', complete);

  const names = new Set(keys.map((k) => cfg.pairings[k].name));
  ok('no asset appears twice', names.size === cells, names.size + ' distinct');

  /* The assets were chosen by colour, not by cell, so that is what is pinned:
     each colour's four, as a set, whichever positions they sit on. */
  const wantByColour = {
    red:    ['Tesla', 'Lululemon', 'GameStop', 'Netflix'],
    yellow: ['Amazon', 'Snapchat', 'Microsoft', 'Gold'],
    green:  ['Nvidia', 'Shopify', 'Bull', 'India'],
    blue:   ['Meta', 'Intel', 'Ford', 'Coinbase'],
  };
  Object.keys(wantByColour).forEach((c) => {
    const got = cfg.positions.map((p) => cfg.pairings[p.id + '.' + c].name).sort();
    const want = wantByColour[c].slice().sort();
    ok(`${c} carries ${wantByColour[c].join(', ')}`,
      got.length === want.length && got.every((n, i) => n === want[i]), got.join(', '));
  });

  // and the three cells that were named by position as well as colour
  [
    ['leftHand', 'yellow', 'Amazon'],
    ['leftHand', 'red', 'Tesla'],
    ['leftHand', 'green', 'Nvidia'],
  ].forEach(([p, c, n]) => {
    const a = cfg.pairings[p + '.' + c];
    ok(`${p} + ${c} is ${n}`, !!a && a.name === n, a ? a.name : 'missing');
  });

  // every cell's mark has to resolve to a shape, or it silently falls back
  ok('every cell has its own glyph',
    new Set(keys.map((k) => cfg.pairings[k].glyph)).size === cells);

  // every cell reachable from exactly one node of the wheel
  const secs = sectorsFrom(cfg);
  const seen = new Set(secs.map((s) => s.position + '.' + s.color));
  ok('the wheel carries all sixteen, once each', secs.length === cells && seen.size === cells);
}

/* ---------- the rule, in a browser ---------- */
async function browserChecks() {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) {
    try { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright')); }
    catch (e2) {
      console.log('\nbrowser checks skipped: playwright is not installed here');
      console.log('  install it, or run with CHROME_PATH set, to exercise the rule');
      return false;
    }
  }

  const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) errors.push(m.text()); });

  await page.goto(PAGE);
  await page.waitForTimeout(700);
  const CFG = await page.evaluate(() => window.SPINPAD_CONFIG);
  const SECTORS = sectorsFrom(CFG);
  const SEG = 360 / SECTORS.length;

  await configChecks(CFG);

  console.log('\nthe door');
  ok('the door is up on a first visit', await page.locator('#gate').isVisible());
  ok('and it will not open without the tick', await page.locator('#gateGo').isDisabled());
  await page.check('#gateAgree');
  ok('ticking it opens the way in', !(await page.locator('#gateGo').isDisabled()));
  await page.click('#gateGo');
  await page.waitForTimeout(300);
  ok('accepting closes it', !(await page.locator('#gate').isVisible()));
  await page.reload();
  await page.waitForTimeout(600);
  ok('and it stays closed on the way back', !(await page.locator('#gate').isVisible()));

  /* ---------- the hero ---------- */
  console.log('\nthe hero');
  const wheelObj = await page.evaluate(() => {
    const svg = document.getElementById('heroWheelSvg');
    return {
      rim: svg.querySelectorAll('.sp-rim').length,
      face: svg.querySelectorAll('.sp-face').length,
      ticks: svg.querySelectorAll('.sp-tick').length,
      cross: svg.querySelectorAll('.sp-cross').length,
      quads: svg.querySelectorAll('.sp-quad').length,
      hub: svg.querySelectorAll('.sp-hub').length,
      // the rim has to have thickness: the face cannot reach the outer edge
      rimR: Number(svg.querySelector('.sp-rim').getAttribute('r')),
      faceR: Number(svg.querySelector('.sp-face').getAttribute('r')),
    };
  });
  ok('the wheel is a disc, not a circle with a line round it',
    wheelObj.rim === 1 && wheelObj.face === 1 && wheelObj.hub === 1
    && wheelObj.rimR - wheelObj.faceR >= 8, JSON.stringify(wheelObj));
  ok('its rim is ticked once per outcome', wheelObj.ticks === SECTORS.length, String(wheelObj.ticks));
  ok('and divided by a cross into one quarter per position',
    wheelObj.cross === CFG.positions.length, String(wheelObj.cross));

  /* The quarter names are printed into the rim. Outside it they were captions
     beside a spinner rather than the spinner's own labels, so the check is
     where they physically land: between the face's edge and the rim's. */
  const printed = await page.evaluate(() => {
    const wheel = document.getElementById('heroWheel');
    const svg = document.getElementById('heroWheelSvg');
    const w = wheel.getBoundingClientRect();
    const cx = w.left + w.width / 2, cy = w.top + w.height / 2;
    const unit = svg.getBoundingClientRect().width / 200;   // svg units to px
    const inner = Number(svg.querySelector('.sp-face').getAttribute('r')) * unit;
    const outer = Number(svg.querySelector('.sp-rim').getAttribute('r')) * unit;
    return [...wheel.querySelectorAll('.sp-wheel-label')].map((el) => {
      const b = el.getBoundingClientRect();
      const d = Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy);
      return { text: el.textContent.trim(), inBand: d > inner && d < outer, d: Math.round(d) };
    });
  });
  ok('the quarter names are printed in the rim, not floating outside it',
    printed.length === 4 && printed.every((l) => l.inBand),
    JSON.stringify(printed));

  /* Every circle wears the asset it pairs with, read off the table in the same
     order the nodes are drawn in. A wheel showing sixteen colours and a board
     showing sixteen companies are two different products. */
  const worn = await page.evaluate(() => {
    const svg = document.getElementById('heroWheelSvg');
    return [...svg.querySelectorAll('g[data-i]')].map((g) => ({
      i: Number(g.dataset.i),
      pic: (g.querySelector('.sp-node-pic') || {}).getAttribute
        ? g.querySelector('.sp-node-pic').getAttribute('href') : null,
      disc: !!g.querySelector('.sp-node-disc'),
      glyph: !!g.querySelector('.sp-node-glyph'),
    }));
  });
  const wantLogo = SECTORS.map((sec) => assetAt(CFG, sec).logo);
  ok('every circle on the wheel carries its asset',
    worn.length === SECTORS.length && worn.every((n) => n.pic === wantLogo[n.i]),
    JSON.stringify(worn.filter((n) => n.pic !== wantLogo[n.i])));
  /* The colour is half the draw, so the picture goes on a white disc inside the
     sphere and the colour stays as a ring. And the drawn glyph stays under the
     picture: an <image> with no file renders nothing, so the glyph is the
     fallback for free. */
  ok('on a white disc inside the colour, with the drawn mark still under it',
    worn.every((n) => n.disc && n.glyph));

  /* Sixteen circles on a ring have 2πr/16 of arc each. At r=60 that was 23.6
     against a diameter of 27, so they overlapped and the logos read as one
     crowded strip. This measures the drawing rather than the numbers: the gap
     between neighbouring centres has to beat the diameter. */
  const spacing = await page.evaluate(() => {
    const svg = document.getElementById('heroWheelSvg');
    const c = [...svg.querySelectorAll('.sp-node')]
      .map((n) => [Number(n.getAttribute('cx')), Number(n.getAttribute('cy')), Number(n.getAttribute('r'))]);
    let worst = Infinity;
    for (let i = 0; i < c.length; i++) {
      const n = c[(i + 1) % c.length];
      worst = Math.min(worst, Math.hypot(n[0] - c[i][0], n[1] - c[i][1]));
    }
    return { worst, d: c[0][2] * 2 };
  });
  ok('the circles do not touch each other',
    spacing.worst > spacing.d,
    `closest centres ${spacing.worst.toFixed(1)} apart, diameter ${spacing.d}`);

  /* The chip under the headline names a real cell of the board. A name written
     into the markup is exactly the bug this replaced: the hero advertised a
     token that had been off the board for two releases. */
  const liveOf = () => page.evaluate(() => ({
    name: document.getElementById('heroLiveName').textContent.trim(),
    colour: document.getElementById('heroLive').dataset.color,
    logo: document.getElementById('heroLiveMark').style.backgroundImage,
  }));
  const names = Object.values(CFG.pairings).map((a) => a.name);
  const live1 = await liveOf();
  ok('the live chip names something that is actually on the board',
    names.includes(live1.name), live1.name);
  const liveAsset = Object.entries(CFG.pairings)
    .find(([, a]) => a.name === live1.name);
  ok('and wears that cell\'s own colour',
    !!liveAsset && liveAsset[0].split('.')[1] === live1.colour,
    `${live1.name} is ${liveAsset ? liveAsset[0] : '?'}, chip says ${live1.colour}`);
  ok('and that cell\'s own logo', !!liveAsset && live1.logo.includes(liveAsset[1].logo),
    live1.logo);

  await page.waitForTimeout(2600);
  const live2 = await liveOf();
  ok('it moves on by itself', live2.name !== live1.name, `${live1.name} → ${live2.name}`);

  /* Pausing motion is not only about the drifting spheres: the chip is one more
     thing moving for ever, so it holds too. */
  await page.click('#motion');
  const held = await liveOf();
  await page.waitForTimeout(2600);
  const stillHeld = await liveOf();
  ok('and holds when motion is paused', stillHeld.name === held.name,
    `${held.name} → ${stillHeld.name}`);
  await page.click('#motion');

  const facts = await page.evaluate(() =>
    [...document.querySelectorAll('.sp-hero-facts li')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()));
  ok('the hero\'s numbers are the table\'s numbers',
    facts.some((f) => f.startsWith(String(SECTORS.length)))
    && facts.some((f) => f.includes((100 / SECTORS.length).toFixed(2))),
    facts.join(' | '));

  console.log('\nthe drifting sixteen');
  const drift = await page.evaluate(() => {
    const chips = [...document.querySelectorAll('.sp-float')];
    return {
      count: chips.length,
      colours: chips.map((c) => c.dataset.color),
      zones: chips.map((c) => c.dataset.zone),
      logos: chips.map((c) => {
        const i = c.querySelector('img.sp-logo');
        return i ? i.getAttribute('src') : null;
      }),
      behind: chips.every((c) => Number(getComputedStyle(c.closest('.sp-floaters')).zIndex) < 0),
      inert: getComputedStyle(document.querySelector('.sp-floaters')).pointerEvents === 'none',
    };
  });
  ok('all sixteen assets drift behind the hero', drift.count === 16, String(drift.count));
  ok('one chip per cell, no asset twice', new Set(drift.logos).size === 16,
    new Set(drift.logos).size + ' distinct');
  ok('four of each colour, like the table',
    ['red', 'yellow', 'green', 'blue'].every((k) => drift.colours.filter((c) => c === k).length === 4),
    JSON.stringify(drift.colours));
  ok('every chip is tagged with a zone, so a phone can drop the inner ones',
    drift.zones.every((z) => ['edge', 'band', 'inner'].includes(z)));
  ok('the layer sits behind the page and swallows no clicks', drift.behind && drift.inert);

  // sixteen things moving for ever is the case a pause control exists for
  const paused = await page.evaluate(async () => {
    const chip = document.querySelector('.sp-float-in');
    const before = getComputedStyle(chip).animationPlayState;
    document.getElementById('motion').click();
    await new Promise((r) => setTimeout(r, 60));
    const after = getComputedStyle(chip).animationPlayState;
    const label = document.getElementById('motion').textContent.trim();
    const pressed = document.getElementById('motion').getAttribute('aria-pressed');
    document.getElementById('motion').click();
    await new Promise((r) => setTimeout(r, 60));
    return { before, after, label, pressed, back: getComputedStyle(chip).animationPlayState };
  });
  ok('the motion control really stops them',
    paused.before === 'running' && paused.after === 'paused' && paused.back === 'running',
    JSON.stringify(paused));
  ok('and says so, to a screen reader too',
    paused.label === 'Resume motion' && paused.pressed === 'true', JSON.stringify(paused));

  /* ---------- the board ---------- */
  console.log('\nthe board');
  ok('the board is the whole four-by-four', await page.locator('#board .sp-cell').count() === 16);
  ok('with a heading for every colour', await page.locator('#board .sp-board-head').count() === 4);
  ok('and a label for every position', await page.locator('#board .sp-board-side').count() === 4);
  ok('nothing is read out before a cell is picked', await page.locator('#boardRead').isHidden());

  const firstCell = page.locator('#board .sp-cell').first();
  const cellPos = await firstCell.getAttribute('data-pos');
  const cellCol = await firstCell.getAttribute('data-color');
  await firstCell.click();
  await page.waitForTimeout(200);
  const readOut = await page.locator('#boardRead').textContent();
  const cellAsset = CFG.pairings[cellPos + '.' + cellCol];
  ok('picking a cell reads out its asset', readOut.includes(cellAsset.name), readOut.slice(0, 60));
  ok('and names the combination that reaches it',
    readOut.includes(comboAt(CFG, { position: cellPos, color: cellCol })));

  ok('the asset desk carries the same sixteen', await page.locator('#matrix .sp-desk-card').count() === 16);

  /* ---------- the flow ---------- */
  console.log('\ncreate → spin → result → launch');
  const launched = () => page.locator('.sp-launch').count();
  const before = await launched();

  ok('the pad opens on create', await page.getAttribute('#pad', 'data-step') === '1');
  ok('launch control ships disabled', await page.locator('#launchBtn').isDisabled());
  ok('spin is closed until the details are in', await page.locator('#spin').isDisabled());

  // force the control open from outside and click it
  await page.evaluate(() => { document.getElementById('launchBtn').disabled = false; });
  await page.evaluate(() => document.getElementById('launchBtn').click());
  await page.waitForTimeout(250);
  ok('a forced launch with no spin launches nothing', await launched() === before);
  ok('and the control closes again', await page.locator('#launchBtn').isDisabled());

  // a draft that does not validate does not move on
  await page.fill('#fName', 'x');
  await page.click('#toSpin');
  await page.waitForTimeout(200);
  ok('an invalid draft stays on create', await page.getAttribute('#pad', 'data-step') === '1');

  await page.fill('#fName', 'Northwind Capital');
  await page.fill('#fTicker', 'NWND');
  await page.fill('#fSupply', '250000000');
  await page.fill('#fDesc', 'Checked by the test suite.');

  /* ---------- the picture ----------
   *
   * The field used to take a URL and its risk was a hostile one. It takes a
   * file now, and the risk moved: the only string that can reach the record is
   * one this code encoded off a canvas, and anything else has to be refused —
   * on the way in and again on the way out. */
  console.log('\nthe picture');
  await page.setInputFiles('#fImage', {
    name: 'big.png', mimeType: 'image/png', buffer: bigPng(900, 700),
  });
  await page.waitForTimeout(700);
  const pic = await page.evaluate(() => new Promise((resolve) => {
    const src = document.getElementById('imageThumb').src;
    const img = new Image();
    img.onload = () => resolve({
      src: src.slice(0, 24),
      bytes: Math.round(src.length * 0.75),
      w: img.naturalWidth, h: img.naturalHeight,
      shown: !document.getElementById('imageHas').hidden,
      onOrb: !document.getElementById('orbPic').hidden,
      name: document.getElementById('imageName').textContent,
    });
    img.onerror = () => resolve({ src, broken: true });
    img.src = src;
  }));
  ok('a picked file is read and shown', pic.shown && pic.onOrb && pic.name === 'big.png',
    JSON.stringify(pic));
  ok('and it is an image the browser made, not the bytes that were handed in',
    /^data:image\/(webp|png|jpeg);base64,/.test(pic.src), pic.src);
  ok('900×700 comes back inside 256px', Math.max(pic.w, pic.h) <= 256, `${pic.w}×${pic.h}`);
  ok('and small enough to keep in this browser', pic.bytes < 220e3, pic.bytes + ' bytes');

  // a file that is not a picture never becomes one
  await page.setInputFiles('#fImage', {
    name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('<script>alert(1)</script>'),
  });
  await page.waitForTimeout(400);
  const refused = await page.evaluate(() => ({
    msg: document.querySelector('.sp-err[data-for="fImage"]').textContent.trim(),
    bad: document.getElementById('imageDrop').classList.contains('is-bad'),
    held: !document.getElementById('imageHas').hidden,
    onOrb: !document.getElementById('orbPic').hidden,
  }));
  ok('a file that is not an image is refused', !!refused.msg && refused.bad, JSON.stringify(refused));
  ok('and nothing of it is kept', !refused.held && !refused.onOrb, JSON.stringify(refused));

  // put a good one back, because Remove is only there when something is held
  await page.setInputFiles('#fImage', {
    name: 'again.png', mimeType: 'image/png', buffer: bigPng(400, 400),
  });
  await page.waitForTimeout(600);
  await page.click('#imageClear');
  await page.waitForTimeout(300);
  const cleared = await page.evaluate(() => ({
    held: !document.getElementById('imageHas').hidden,
    onOrb: !document.getElementById('orbPic').hidden,
    full: document.getElementById('imageDrop').classList.contains('is-full'),
  }));
  ok('remove puts the field back', !cleared.held && !cleared.onOrb && !cleared.full,
    JSON.stringify(cleared));

  ok('the pairing slot is empty before the spin',
    (await page.locator('#assetName').textContent()).trim() === 'Decided by the wheel');

  /* The panel beside the form mirrors the draft as it is typed, and it is the
     same list of rows the confirmation shows. Two copies of that list is two
     chances for the screen someone reads to disagree with the screen that
     launches, so the check is that they are byte for byte the same. */
  const live = await page.evaluate(() => ({
    rows: document.getElementById('liveRows').innerHTML,
    mirror: document.getElementById('sumRows').innerHTML,
    name: document.getElementById('liveName').textContent.trim(),
    orb: document.getElementById('orbTicker').textContent.trim(),
    orbPair: document.getElementById('orbTicker').nextElementSibling.textContent.trim(),
    pairing: [...document.querySelectorAll('#liveRows > div')]
      .map((d) => d.querySelector('dt').textContent + '=' + d.querySelector('dd').textContent),
  }));
  ok('the live summary follows what is typed',
    live.name === 'Northwind Capital' && live.orb === 'NWND', JSON.stringify(live).slice(0, 120));
  /* Supply reformats on blur but has to read on input, or the panel beside the
     field shows the previous number while the new one is on screen next to it. */
  ok('including the supply, before the field is left',
    live.pairing.includes('Total supply=250,000,000'), live.pairing.join(' | '));
  ok('and says the same as the confirmation, row for row', live.rows === live.mirror);
  ok('with the pairing still the wheel\u2019s to give',
    live.pairing.includes('Pairing=Decided by the wheel')
    && live.pairing.includes('Spin result=Not spun yet')
    && live.orbPair === 'unpaired', live.pairing.join(' | '));

  await page.click('#toSpin');
  await page.waitForTimeout(250);
  ok('the note says a wallet is for launching, not for spinning',
    /still fill this in and spin/i.test(await page.locator('#walletNoteText').textContent()),
    (await page.locator('#walletNoteText').textContent()).slice(0, 70));
  ok('and offers no connect button when there is no wallet to connect',
    await page.locator('#connectInline').isHidden());

  /* Advancing used to centre the SPIN button, which put the stage's heading
     behind the sticky bar — and the bigger the wheel got, the more went with
     it. The stage's top is what is scrolled to now. */
  await settle(page);          // the scroll is smooth; measuring mid-flight reads the start
  const clears = await page.evaluate(() => {
    const st = document.querySelector('.sp-stage[data-stage="2"]');
    const head = st.querySelector('.sp-kicker');
    const nav = document.querySelector('header').getBoundingClientRect();
    const hb = head.getBoundingClientRect();
    return { top: Math.round(hb.top), navBottom: Math.round(nav.bottom) };
  });
  ok('the spin stage arrives below the nav, not behind it',
    clears.top >= clears.navBottom, JSON.stringify(clears));

  /* And the control the screen exists for is on the screen. Without a height
     cap the wheel grew until SPIN was below the fold on every desktop. */
  const spinSeen = await page.evaluate(() => {
    const b = document.getElementById('spin').getBoundingClientRect();
    return { bottom: Math.round(b.bottom), vh: window.innerHeight };
  });
  ok('and the spin control is on screen with it',
    spinSeen.bottom <= spinSeen.vh, JSON.stringify(spinSeen));

  ok('the spin opens on step two', !(await page.locator('#spin').isDisabled()));
  ok('the launch control is still shut on step two', await page.locator('#launchBtn').isDisabled());
  ok('the details are locked while the wheel is up',
    await page.evaluate(() => document.getElementById('fields').disabled));

  await page.click('#spin');
  await page.waitForFunction(() => document.getElementById('pad').dataset.step === '3', null, { timeout: 14000 });
  await page.waitForTimeout(400);

  /* What the wheel actually landed on, worked out from where the arrow came to
     rest. The arrow lives on the spin stage, which is display:none once the
     result is up, and a computed transform is not resolved on one of those —
     so the rotation is read from the custom property that drives it. */
  const angle = await page.evaluate(() => {
    const raw = getComputedStyle(document.getElementById('needle')).getPropertyValue('--rot');
    return ((parseFloat(raw) % 360) + 360) % 360;
  });
  const drew = SECTORS[Math.floor(angle / SEG)];
  const expected = assetAt(CFG, drew);
  const expectedCombo = comboAt(CFG, drew);

  console.log('\nthe pairing');
  const resAsset = (await page.locator('#resColor').textContent()).trim();
  const resCombo = (await page.locator('#resLimb').textContent()).trim();
  ok('the result names the asset under the arrow', resAsset === expected.name,
    `arrow at ${angle.toFixed(1)}° is ${expected.name}, result says "${resAsset}"`);
  ok('and the combination it landed on', resCombo === expectedCombo, `"${resCombo}" vs "${expectedCombo}"`);

  /* The wheel is not allowed to be a picture of something else. The node the
     page marked is measured off the drawing and its bearing from the centre
     compared with where the arrow stopped: if app.js ever drew the nodes in a
     different order from the one it draws the result from, they part company
     here. */
  const hot = await page.evaluate(() => {
    const n = document.querySelector('#dial .sp-node.is-hot');
    if (!n) return null;
    const cx = Number(n.getAttribute('cx')), cy = Number(n.getAttribute('cy'));
    return ((Math.atan2(cx - 100, 100 - cy) * 180 / Math.PI) % 360 + 360) % 360;
  });
  const bearingGap = hot === null ? 999 : Math.abs((((hot - angle) % 360) + 540) % 360 - 180);
  ok('the node the wheel marked is the one the arrow is over', bearingGap <= SEG / 2,
    `node at ${hot === null ? 'none' : hot.toFixed(1)}°, arrow at ${angle.toFixed(1)}°, ${bearingGap.toFixed(1)}° apart`);
  ok('the pairing is announced as locked',
    /locked/i.test(await page.locator('.sp-stage[data-stage="3"]').textContent()));
  const resultControls = await page.evaluate(() =>
    [...document.querySelectorAll('.sp-stage[data-stage="3"] button')].map((b) => b.textContent.trim()));
  ok('nothing on the result offers another spin',
    !resultControls.some((t) => /re-?roll|spin|again|change|re-?draw/i.test(t)),
    resultControls.join(' | '));
  ok('the spin is spent', (await page.locator('#spinCount').textContent()).includes('1/1'));
  ok('there is no way back to the details', await page.locator('#backToForm').isHidden());
  ok('the form slot shows the same asset',
    (await page.locator('#assetName').textContent()).includes(expected.name));

  // force a second spin from outside
  await page.evaluate(() => { const s = document.getElementById('spin'); s.disabled = false; s.click(); });
  await page.waitForTimeout(600);
  ok('a forced second spin does not change the pairing',
    (await page.locator('#resColor').textContent()).trim() === resAsset);
  ok('and does not move the pad off the result',
    await page.getAttribute('#pad', 'data-step') === '3');

  // the launch control cannot be reached by skipping the result
  ok('launch is still shut on the result screen', await page.locator('#launchBtn').isDisabled());

  await page.click('#toLaunch');
  await page.waitForTimeout(300);
  ok('continuing reaches the confirmation', await page.getAttribute('#pad', 'data-step') === '4');
  ok('and only now is launch open', !(await page.locator('#launchBtn').isDisabled()));

  const sum = await page.locator('#sumRows').textContent();
  ok('the confirmation carries the same asset', sum.includes(expected.name), sum.slice(0, 120));
  ok('and the same combination', sum.includes(expectedCombo));

  // the pairing the page would actually send, read out of the flow itself
  const wouldSend = await page.evaluate(() => {
    const s = document.getElementById('sumRows').textContent;
    return s;
  });
  ok('nothing on the confirmation names a different asset',
    Object.keys(CFG.pairings).map((k) => CFG.pairings[k].name)
      .filter((n) => n !== expected.name && wouldSend.includes(n)).length === 0);

  // No wallet is injected in this file, so launching has to refuse rather than
  // pretend. The path that actually deploys is exercised in launch.test.js with
  // a fake wallet, where the bytes it would send are checked.
  await page.click('#launchBtn');
  await page.waitForTimeout(500);
  ok('without a wallet the pad refuses to launch',
    /wallet/i.test(await page.locator('#status').textContent()));
  ok('and launches nothing', await launched() === before);
  ok('the record stays closed', !(await page.locator('#ticket').isVisible()));
  ok('and the pad has not moved past the confirmation',
    await page.getAttribute('#pad', 'data-step') === '4');

  /* ---------- the furniture ---------- */
  console.log('\nthe rest of it');
  await page.click('#sortBtn');
  await page.waitForTimeout(250);
  ok('the sort menu opens', await page.locator('#sortMenu').isVisible());
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  ok('choosing with the keyboard closes it', !(await page.locator('#sortMenu').isVisible()));
  ok('and the button reports the choice',
    (await page.locator('#sortBtn').textContent()).trim().length > 0);

  ok('the proof list is empty, not invented',
    await launched() === 0 && !(await page.locator('#empty').isHidden()));

  // a logo file that is not there must cost nothing
  const marks = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img.sp-logo')];
    return {
      drawn: document.querySelectorAll('.sp-glyph').length,
      visibleImages: imgs.filter((i) => getComputedStyle(i).opacity !== '0').length,
      loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
    };
  });
  ok('every cell has a mark', marks.drawn >= 16, marks.drawn + ' drawn');
  ok('a missing logo file shows nothing at all', marks.visibleImages === marks.loaded,
    marks.visibleImages + ' visible, ' + marks.loaded + ' actually loaded');

  /* A logo that loaded has to end up on a white disc, or a red Tesla lands on
     a red circle and disappears. The colour moves to the ring, so the disc
     still says which colour the cell is. */
  const discs = await page.evaluate(() => {
    const out = { withLogo: 0, white: 0, ringed: 0, coloured: 0 };
    document.querySelectorAll('#boardGrid .sp-cell-node').forEach((d) => {
      const cs = getComputedStyle(d);
      const has = d.querySelector('img.sp-logo');
      const loaded = has && has.complete && has.naturalWidth > 0;
      if (!loaded) { if (cs.backgroundColor !== 'rgb(255, 255, 255)') out.coloured += 1; return; }
      out.withLogo += 1;
      if (cs.backgroundColor === 'rgb(255, 255, 255)') out.white += 1;
      if (/inset/.test(cs.boxShadow)) out.ringed += 1;
    });
    return out;
  });
  ok('a loaded logo sits on a white disc',
    discs.withLogo > 0 && discs.white === discs.withLogo, JSON.stringify(discs));
  ok('and the colour is still there as a ring', discs.ringed === discs.withLogo, JSON.stringify(discs));
  /* Every cell now ships a logo, so nothing on the page exercises the fallback
     any more and `coloured === 16 - withLogo` passes by being 0 === 0. Put a
     cell with a file that is not there in front of the same code and watch it
     stay coloured: that is the behaviour worth keeping, and it is the one that
     quietly rots the moment the last drawn mark disappears. */
  const missing = await page.evaluate(async () => {
    const holder = document.createElement('span');
    holder.className = 'sp-cell-node';
    holder.dataset.color = 'red';
    holder.innerHTML = '<span class="sp-mark" style="--m:24px">'
      + '<svg class="sp-glyph" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7"/></svg>'
      + '<img class="sp-logo" src="assets/there-is-no-such-file.png" alt="">'
      + '</span>';
    document.getElementById('boardGrid').appendChild(holder);
    await new Promise((r) => setTimeout(r, 900));
    const cs = getComputedStyle(holder);
    const img = holder.querySelector('img.sp-logo');
    const out = {
      gotHasLogo: holder.classList.contains('has-logo'),
      background: cs.backgroundColor,
      imageVisible: getComputedStyle(img).opacity !== '0',
      glyphVisible: getComputedStyle(holder.querySelector('.sp-glyph')).visibility !== 'hidden',
    };
    holder.remove();
    return out;
  });
  ok('a file that is not there never turns the disc white',
    !missing.gotHasLogo && missing.background !== 'rgb(255, 255, 255)', JSON.stringify(missing));
  ok('and shows no broken image, just the drawn mark',
    !missing.imageVisible && missing.glyphVisible, JSON.stringify(missing));

  /* All sixteen now carry a file, so this counts sixteen rather than a split.
     What keeps it from being vacuous is the injected cell above: the fallback
     is proved against a file that is not there, not against a cell that has
     none left. */
  ok('all sixteen cells are on white discs, with a file behind each one',
    discs.withLogo === 16 && discs.coloured === 0, JSON.stringify(discs));

  // both wheels carry all sixteen nodes, and their corner labels match the table
  const nodes = await page.evaluate(() => ({
    hero: document.querySelectorAll('#heroWheelSvg .sp-node').length,
    pad: document.querySelectorAll('#dial .sp-node').length,
  }));
  ok('the hero wheel has sixteen nodes', nodes.hero === 16, String(nodes.hero));
  ok('the pad wheel has sixteen nodes', nodes.pad === 16, String(nodes.pad));

  /* Two wheels in one document, each with its own gradients. Sharing the ids
     is invalid and fails silently — the second wheel just paints itself with
     the first one's fills, which looks fine until the two wheels differ. */
  const grads = await page.evaluate(() => {
    const ids = (id) => [...document.querySelectorAll('#' + id + ' defs radialGradient')].map((g) => g.id);
    const hero = ids('heroWheelSvg'), pad = ids('dial');
    const all = [...document.querySelectorAll('svg defs radialGradient')].map((g) => g.id);
    return {
      hero, pad,
      shared: hero.filter((i) => pad.includes(i)),
      duplicated: all.length !== new Set(all).size,
      fills: [...document.querySelectorAll('#dial .sp-node')].map((n) => n.getAttribute('fill')),
    };
  });
  ok('each wheel has its own gradient ids',
    grads.hero.length > 0 && grads.shared.length === 0 && !grads.duplicated, JSON.stringify(grads.shared));
  ok('and every node is painted with one of its own',
    grads.fills.length === 16 && grads.fills.every((f) => /^url\(#dial-/.test(f)),
    grads.fills.slice(0, 2).join(' '));

  // the corner labels are written from the table, so quarter 0 sits top-right
  const corners = await page.evaluate(() => ({
    tr: document.querySelector('#heroWheel .sp-wheel-tr').textContent,
    br: document.querySelector('#heroWheel .sp-wheel-br').textContent,
    bl: document.querySelector('#heroWheel .sp-wheel-bl').textContent,
    tl: document.querySelector('#heroWheel .sp-wheel-tl').textContent,
  }));
  ok('the wheel is labelled in the table’s own order',
    corners.tr === CFG.positions[0].label && corners.br === CFG.positions[1].label
    && corners.bl === CFG.positions[2].label && corners.tl === CFG.positions[3].label,
    JSON.stringify(corners));

  // nothing on the page should be reachable only by mouse
  ok('the nav links are focusable',
    await page.evaluate(() => [...document.querySelectorAll('.sp-nav-links a')].every((a) => a.hasAttribute('href'))));

  ok('no console errors along the way', errors.length === 0, errors.join(' / '));

  /* ---------- it has to work on a phone ---------- */
  console.log('\nresponsive');

  /* The hero is one screen and the next section stays off it. A hero sized in
     `vh` on a window whose height it does not fill leaves the board peeking in
     at the bottom, which is the whole thing this is for — so it is measured at
     a tall window, a short one and a phone, not just the one it was built at. */
  for (const [w, h] of [[1440, 950], [1440, 760], [1512, 700], [1024, 800], [1280, 1100], [768, 900], [390, 844]]) {
    // eslint-disable-next-line no-await-in-loop
    await page.setViewportSize({ width: w, height: h });
    /* Back to the top, and not with a smooth scroll: the page sets
       scroll-behavior: smooth, so scrollTo(0, 0) animates and a fixed wait
       lands somewhere down the page. Five pixels of leftover scroll is all it
       takes to report the board peeking when it is not. */
    // eslint-disable-next-line no-await-in-loop
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    // eslint-disable-next-line no-await-in-loop
    await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 4000 });
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(300);
    // eslint-disable-next-line no-await-in-loop
    const first = await page.evaluate(() => {
      const board = document.getElementById('board').getBoundingClientRect().top;
      const pause = document.getElementById('motion').getBoundingClientRect();
      return {
        peek: Math.round(window.innerHeight - board),
        pauseOnScreen: pause.top >= 0 && pause.bottom <= window.innerHeight,
      };
    });
    ok(`nothing of the board shows at ${w}×${h}`, first.peek <= 0, first.peek + 'px of it visible');
    ok(`and the motion control is on screen at ${w}×${h}`, first.pauseOnScreen);
  }

  for (const [w, h] of [[1440, 950], [1024, 800], [768, 900], [390, 844]]) {
    // eslint-disable-next-line no-await-in-loop
    await page.setViewportSize({ width: w, height: h });
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(400);
    // eslint-disable-next-line no-await-in-loop
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`no sideways scroll at ${w}px`, over <= 1, over + 'px over');
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  ok('the nav collapses to a menu on a phone', await page.locator('#burger').isVisible());
  ok('and the links are put away', await page.locator('#navlinks').isHidden());
  await page.click('#burger');
  await page.waitForTimeout(250);
  ok('the menu opens', await page.locator('#navlinks').isVisible());
  await page.locator('#navlinks a').first().click();
  await page.waitForTimeout(300);
  ok('and closes again when you pick something', await page.locator('#navlinks').isHidden());

  await browser.close();
  return true;
}

(async () => {
  await serverChecks();
  await browserChecks();

  console.log('\n' + passed + ' passed, ' + fails.length + ' failed');
  if (fails.length) {
    fails.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
})();
