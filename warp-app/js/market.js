/* The price feed.

   NOTICE, AND IT GOVERNS THE WHOLE PROJECT: there is no real market data here.
   Warp is a paper market and this simulator produces its prices. The reference
   levels below are orders of magnitude picked so the interface reads, not
   quotes. No number in this application describes the real market, and the
   interface says so in the header and the footer of every screen instead of
   leaving it in the small print.

   How it works: an asset's price at an instant is a sum of waves of different
   scales, with phase and amplitude seeded from the symbol. That gives three
   properties a random walk does not:
   - it is reproducible: the same seed gives the same market on every reload and
     in every tab, so a position opened yesterday still makes sense today;
   - it is continuous: there are no jumps between reloads;
   - it can be evaluated at any instant in constant time, so a chart's history
     does not have to be stored: it is computed.

   To plug in a real provider later, there is `setFeed()` at the end: the
   application only knows that interface, not this simulator. */

import { config } from './config.js';
import { getAsset } from './registry.js';

/* The simulator's reference levels. These are not quotes. */
const REF = {
  NVDA:180, AAPL:240, MSFT:500, GOOGL:240, AMZN:230, META:720, TSLA:400, AMD:165,
  INTC:35, AVGO:350, TSM:260, ASML:900, ORCL:240, CRM:260, ADBE:380, PLTR:160,
  NFLX:1200, SPOT:680, UBER:90, ABNB:130, SHOP:150, DIS:115, KO:70, PEP:145,
  MCD:300, SBUX:95, NKE:75, WMT:100, LLY:800, JNJ:175, BA:210, CAT:400, V:340,
  MA:570, JPM:290, GS:700, COIN:320, HOOD:110, MSTR:320, XOM:115,
  SAN:8, BBVA:15, ITX:48, IBE:15, MC:620, SAP:250, NOVO:60, FER:450,
  XAU:3400, XAG:40, XPT:1400, XPD:1200, XCU:9800, XAL:2600, XNI:15500,
  XZN:2900, XSN:33000, XPB:2000, XLI:11000, XCO:33000,
  BTC:95000, ETH:3300, SOL:180, XRP:2.4, DOGE:0.18, AVAX:28, LINK:20, ADA:0.7,
  SPY:640, QQQ:570, VOO:590, GLD:310, SLV:36,
  USDG:1,
};

/* How much each class moves, relative to a stock. */
const VOL = { stock:1, etf:0.55, metal:0.85, crypto:2.2, settle:0 };

const MIN = 60e3, HOUR = 3600e3, DAY = 24 * HOUR;
/* Wave scales, from the background trend to the flicker of a tick. */
const WAVES = [
  { period: 34 * DAY, amp: 0.150 },
  { period: 9 * DAY,  amp: 0.095 },
  { period: 2.4 * DAY, amp: 0.062 },
  { period: 7 * HOUR, amp: 0.032 },
  { period: 43 * MIN, amp: 0.013 },
  { period: 11 * MIN, amp: 0.0055 },
  { period: 2.2 * MIN, amp: 0.0022 },
];

function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shapes = new Map();
function shape(id) {
  if (shapes.has(id)) return shapes.get(id);
  const asset = getAsset(id);
  const rnd = mulberry32(hash32(id + '|' + config.seed));
  const vol = VOL[asset?.class] ?? 1;
  const s = {
    base: REF[id] ?? 100,
    vol,
    // Each wave gets its own phase and its amplitude is roughed up a little, so
    // two assets of the same class do not move in lockstep.
    waves: WAVES.map(w => ({
      w: (2 * Math.PI) / w.period,
      phase: rnd() * Math.PI * 2,
      amp: w.amp * vol * (0.7 + rnd() * 0.6),
    })),
    // The asset's reference volume, also simulated.
    volBase: (0.4 + rnd() * 3.2) * 1e6,
  };
  shapes.set(id, s);
  return s;
}

/** The asset's price at an instant. Constant time and stateless. */
export function spot(id, t = Date.now()) {
  const s = shape(id);
  if (!s.vol) return s.base;                     // USDG does not move
  let e = 0;
  for (const w of s.waves) e += w.amp * Math.sin(w.w * t + w.phase);
  return s.base * Math.exp(e);
}

/** The asset's percentage change over the last `hours` hours. */
export function changePct(id, hours = 24, t = Date.now()) {
  const then = spot(id, t - hours * HOUR);
  if (!then) return 0;
  return ((spot(id, t) / then) - 1) * 100;
}

/** Time series for a chart. Not stored: evaluated. */
export function series(id, from, to, points = 180) {
  const step = (to - from) / Math.max(points - 1, 1);
  const out = [];
  for (let i = 0; i < points; i++) {
    const t = from + i * step;
    out.push({ t, c: spot(id, t) });
  }
  return out;
}

/** The asset's simulated 24 h volume, in settlement units. */
export function volume24h(id, t = Date.now()) {
  const s = shape(id);
  if (!s.vol) return 0;
  const heat = 1 + Math.abs(changePct(id, 24, t)) / 12;
  const wobble = 0.75 + 0.5 * (0.5 + 0.5 * Math.sin(shape(id).waves[3].w * t + 1.7));
  return s.base * s.volBase * heat * wobble / 1000;
}

/* -------- the basket --------
   A fixed-weight index is worth, at base 100 from the day it listed:
       V(t) = 100 * sum_i  w_i * P_i(t) / P_i(t0)
   The P_i(t0) are the references frozen when the index lists, and they live in
   the index itself. So its chart measures exactly what the basket has done
   since it existed, and listing a new one does not rewrite anyone's history. */

export function basketValue(legs, refs, t = Date.now(), base = 100) {
  let v = 0;
  for (const leg of legs) {
    const ref = refs?.[leg.id];
    if (!ref) return null;                       // no reference, no index
    v += (leg.weight / 100) * (spot(leg.id, t) / ref);
  }
  return base * v;
}

export function basketSeries(legs, refs, from, to, points = 180, base = 100) {
  const step = (to - from) / Math.max(points - 1, 1);
  const out = [];
  for (let i = 0; i < points; i++) {
    const t = from + i * step;
    const c = basketValue(legs, refs, t, base);
    if (c !== null) out.push({ t, c });
  }
  return out;
}

export function basketChangePct(legs, refs, hours = 24, t = Date.now()) {
  const now = basketValue(legs, refs, t);
  const then = basketValue(legs, refs, t - hours * HOUR);
  if (now === null || then === null || !then) return null;
  return ((now / then) - 1) * 100;
}

/** Snapshot of a basket's references at the moment it lists. */
export function snapshotRefs(legs, t = Date.now()) {
  const refs = {};
  for (const leg of legs) refs[leg.id] = spot(leg.id, t);
  return refs;
}

/* -------- extension point --------
   The application never calls the simulator directly: it calls these functions.
   A real provider is plugged in by replacing them, and nothing else in the
   application changes. While the feed is the simulator, `isSimulated` is true
   and the interface announces it. */
export const feed = { spot, changePct, series, volume24h, isSimulated: true, label: 'Warp simulator' };
export function setFeed(next) { Object.assign(feed, next); }
