/* Runtime configuration, and the market's parameters in one place so the
   interface and the engine cannot disagree about the rules. */

export const VENUE = {
  name: 'Perpix',
  tagline: 'Index perpetuals',
  settle: 'USDG',
  /** A basket is fixed-weight and holds three to five legs: fewer is not an
   *  index, and more dilutes each weight until the basket says nothing. */
  minLegs: 3,
  maxLegs: 5,
  maxLeverage: 5,
  /** Fee on opening and on closing, charged on notional. */
  takerFee: 0.0005,
  /** Of the total fees a position pays, this share goes to the index's
   *  creator. The protocol keeps the rest. */
  creatorShare: 0.30,
  /** Maintenance margin: below this a position is liquidated. */
  maintenanceMargin: 0.005,
  /** Reference funding per 8 h, scaled by the imbalance between longs and
   *  shorts. */
  fundingBase: 0.0001,
  fundingCap: 0.00075,
  /** Paper balance a new account starts with. */
  openingBalance: 10000,
  minMargin: 10,
  /** An index starts at base 100 the day it lists, so its chart measures
   *  exactly what the basket has done since then. */
  indexBase: 100,
};

/* Official logos are resolved from each entity's own domain at runtime. No copy
   is kept in the repository, so a logo cannot go stale or diverge between
   screens. */
const KEY = 'perpix.config';
const LEGACY_KEY = 'warp.config';
const DEFAULTS = {
  logoTemplate: 'https://img.logo.dev/{domain}?token={logoToken}&size=128&format=png&retries=0',
  logoToken: '',
  /* Fallback resolvers, in order. None needs a key, so the app shows real logos
     with nothing configured; the paid one only improves coverage and resolution
     when a token is present. */
  logoFallbacks: [
    'https://icons.duckduckgo.com/ip3/{domain}.ico',
    'https://www.google.com/s2/favicons?domain={domain}&sz=128',
  ],
  /** Seed for the price simulator. Fixing it makes the market reproducible
   *  across reloads and across tabs. */
  seed: 20260910,
};

/* Read from the host if there is one and from the browser if there is one: the
   modules do not assume a browser exists, so the logic can run and be tested
   outside of one. */
const host = () => (typeof window === 'undefined' ? null : window.PERPIX_CONFIG);
function read() {
  let saved = {};
  // The old key is read once and moved across: the application was called Warp
  // before it was renamed, and a rename should not reset anyone's settings.
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (raw !== null && localStorage.getItem(KEY) === null) {
      localStorage.setItem(KEY, raw);
      localStorage.removeItem(LEGACY_KEY);
    }
    saved = JSON.parse(raw || '{}');
  } catch { saved = {}; }
  return { ...DEFAULTS, ...(host() || {}), ...saved };
}
export const config = read();
export function saveConfig(patch) {
  const next = { ...read(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  Object.assign(config, next);
  return config;
}
