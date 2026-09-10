/* Generates js/marks.js: the official mark of each asset, embedded.

   Why embed at all, when js/logos.js already resolves a logo from the entity's
   own domain at runtime? Because that resolution needs the network, and two
   places do not have it: a page opened from the filesystem with no connection,
   and a sandboxed host that blocks external images. In both, a runtime-only
   system falls back to a monogram, and a monogram is not the mark.

   So marks.js is a floor, not a replacement. The runtime logo still wins when
   it loads, because it is the entity's current full-colour mark; the embedded
   one is what shows the instant the page opens and what stays if the network
   never answers.

   Nothing here is drawn or approximated. Every mark comes from a published,
   CC0-licensed icon set, and each entry records which set it came from so the
   interface can say so. The marks themselves remain the trademarks of their
   owners, used only to identify the asset.

   Run with:  node perpix-app/tools/build-marks.mjs
   It needs network access to registry.npmjs.org and rewrites js/marks.js. */

import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* The sets, in the order a mark is preferred: colour before monochrome.
   `licence` is carried through into the generated file and shown in the
   application, because one of these sets asks for attribution and the only
   honest way to give it is where the mark is used. */
const SETS = {
  logos:  { pkg: '@iconify-json/logos', licence: 'CC0-1.0', colour: true, kind: 'iconify' },
  crypto: { pkg: 'cryptocurrency-icons', licence: 'CC0-1.0', colour: true, kind: 'files' },
  cib:    { pkg: '@iconify-json/cib', licence: 'CC0-1.0', colour: false, kind: 'iconify' },
  simple: { pkg: 'simple-icons', licence: 'CC0-1.0', colour: false, kind: 'simple' },
  // CC BY-SA 4.0: attribution required, and the icons stay under that licence.
  // Used only for the four marks no permissive set carries.
  arctic: { pkg: '@iconify-json/arcticons', licence: 'CC-BY-SA-4.0', colour: false, kind: 'iconify' },
};

/* One row per asset that has a real mark available.
   `brand` is set when the mark belongs to a brand of the listed entity rather
   than to the entity itself, so the interface can name it instead of quietly
   passing one identity off as another. */
const MAP = {
  NVDA: ['logos', 'nvidia'],       AAPL: ['logos', 'apple'],
  MSFT: ['logos', 'microsoft'],    GOOGL: ['logos', 'google', 'Google'],
  META: ['logos', 'meta'],         AMD: ['logos', 'amd'],
  INTC: ['logos', 'intel'],        AVGO: ['logos', 'broadcom'],
  TSM: ['logos', 'tsmc'],          ORCL: ['logos', 'oracle'],
  CRM: ['logos', 'salesforce'],    ADBE: ['logos', 'adobe'],
  NFLX: ['logos', 'netflix'],      SPOT: ['logos', 'spotify'],
  ABNB: ['logos', 'airbnb'],       SHOP: ['logos', 'shopify'],
  V: ['logos', 'visa'],            MA: ['logos', 'mastercard'],
  SAP: ['logos', 'sap'],

  AMZN: ['cib', 'amazon'],         TSLA: ['cib', 'tesla'],
  PLTR: ['cib', 'palantir'],       UBER: ['cib', 'uber'],
  BA: ['cib', 'boeing'],           JPM: ['cib', 'chase', 'Chase'],

  KO: ['simple', 'cocacola'],      MCD: ['simple', 'mcdonalds'],
  SBUX: ['simple', 'starbucks'],   NKE: ['simple', 'nike'],
  CAT: ['simple', 'caterpillar'],  GS: ['simple', 'goldmansachs'],
  COIN: ['simple', 'coinbase'],    HOOD: ['simple', 'robinhood'],
  MSTR: ['simple', 'microstrategy', 'MicroStrategy'],
  ITX: ['simple', 'zara', 'Zara'], FER: ['simple', 'ferrari'],

  DIS: ['arctic', 'disney'],       WMT: ['arctic', 'walmart'],
  SAN: ['arctic', 'santander'],    BBVA: ['arctic', 'bbva'],

  BTC: ['crypto', 'btc'],          ETH: ['crypto', 'eth'],
  SOL: ['crypto', 'sol'],          XRP: ['crypto', 'xrp'],
  DOGE: ['crypto', 'doge'],        AVAX: ['crypto', 'avax'],
  LINK: ['crypto', 'link'],        ADA: ['crypto', 'ada'],
};

async function fetchPackage(dir, pkg) {
  const meta = await (await fetch(`https://registry.npmjs.org/${pkg.replace('/', '%2f')}`)).json();
  const version = meta['dist-tags'].latest;
  const url = meta.versions[version].dist.tarball;
  const tgz = join(dir, pkg.replace(/[@/]/g, '_') + '.tgz');
  await writeFile(tgz, Buffer.from(await (await fetch(url)).arrayBuffer()));
  const out = join(dir, pkg.replace(/[@/]/g, '_'));
  await run('mkdir', ['-p', out]);
  await run('tar', ['xzf', tgz, '-C', out]);
  return { dir: join(out, 'package'), version };
}

/** Strips the wrapper off an SVG file and keeps what is inside it. */
const inner = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').replace(/<title>[\s\S]*?<\/title>/, '').trim();
const viewBox = (svg) => (svg.match(/viewBox="([^"]+)"/) || [, '0 0 24 24'])[1];

const dir = await mkdtemp(join(tmpdir(), 'perpix-marks-'));
try {
  const loaded = {};
  for (const [id, set] of Object.entries(SETS)) {
    const { dir: pkgDir, version } = await fetchPackage(dir, set.pkg);
    loaded[id] = { ...set, version, dir: pkgDir };
    if (set.kind === 'iconify') loaded[id].data = JSON.parse(await readFile(join(pkgDir, 'icons.json'), 'utf8'));
    if (set.kind === 'simple') {
      // The data file is a bare array in some versions and an object with an
      // `icons` key in others, so the shape is checked rather than assumed.
      const raw = JSON.parse(await readFile(join(pkgDir, 'data/simple-icons.json'), 'utf8'));
      const list = Array.isArray(raw) ? raw : raw.icons;
      loaded[id].hexes = Object.fromEntries(list.map(i => [i.slug, i.hex]));
    }
    console.log(`  ${set.pkg}@${version}`);
  }

  const marks = {};
  for (const [asset, [setId, name, brand]] of Object.entries(MAP)) {
    const set = loaded[setId];
    let entry;
    if (set.kind === 'iconify') {
      const icon = set.data.icons[name];
      if (!icon) throw new Error(`${asset}: ${name} is not in ${set.pkg}`);
      const w = icon.width ?? set.data.width ?? 24, h = icon.height ?? set.data.height ?? 24;
      entry = { box: `0 0 ${w} ${h}`, body: icon.body };
    } else if (set.kind === 'simple') {
      const svg = await readFile(join(set.dir, 'icons', `${name}.svg`), 'utf8');
      entry = { box: viewBox(svg), body: inner(svg), tint: '#' + set.hexes[name] };
    } else {
      const svg = await readFile(join(set.dir, 'svg/color', `${name}.svg`), 'utf8');
      entry = { box: viewBox(svg), body: inner(svg) };
    }
    // A monochrome mark is drawn in one colour; the interface supplies it.
    if (!set.colour && !entry.tint) entry.mono = true;
    entry.set = set.pkg;
    entry.licence = set.licence;
    if (brand) entry.brand = brand;
    marks[asset] = entry;
  }

  const versions = Object.entries(loaded).map(([, s]) => `   ${s.pkg}@${s.version} (${s.licence})`).join('\n');
  const rows = Object.entries(marks)
    .map(([id, m]) => `  ${id}: ${JSON.stringify(m)},`)
    .join('\n');

  const file = `/* GENERATED FILE — do not edit by hand.
   Rebuild with: node perpix-app/tools/build-marks.mjs

   The official mark of each asset, embedded so it shows with no network and
   inside a host that blocks external images. js/logos.js still prefers the
   full-colour logo resolved from the entity's own domain when that loads; this
   is the floor beneath it, not a replacement for it.

   Nothing here was drawn or approximated. Sources:
${versions}

   The @iconify-json/arcticons marks are CC BY-SA 4.0, which asks for
   attribution: it is given here, in the README, and in the application itself,
   on each asset's page and in the terms.

   Each entry records the set it came from, and \`brand\` names the brand a mark
   belongs to when that is not the listed entity itself. The marks remain the
   trademarks of their owners and are used only to identify the asset. Assets
   with no entry have no mark in any of these sets; they resolve at runtime or
   fall back to a monogram, never to another entity's logo. */

export const MARKS = {
${rows}
};

export const MARK_SOURCES = ${JSON.stringify(Object.fromEntries(Object.entries(loaded).map(([, s]) => [s.pkg, s.version])), null, 2)};
`;
  await writeFile(join(root, 'js', 'marks.js'), file);
  const kb = (file.length / 1024).toFixed(0);
  console.log(`\njs/marks.js  ${kb} KB  ${Object.keys(marks).length} real marks embedded`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
