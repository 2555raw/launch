/* The market's state: wallet, listed indices and positions.

   This part is real data, within the limits of the application: what is here
   happened because the user did it. The price is simulated, but an open
   position, a fee charged or an index listed are facts, and that is why they
   persist and can be audited.

   One object, one storage key and one change event, so no screen can paint a
   balance that no longer exists. */

import { VENUE } from './config.js';
import { snapshotRefs } from './market.js';

const KEY = 'perpix.state.v1';
/* The application was called Warp until it was renamed, and its state was
   stored under that name. An account is not something to throw away over a
   rename, so the old key is read once and carried over. */
const LEGACY_KEY = 'warp.state.v1';
const DAY = 86400e3;

/* Indices already listed when you arrive, so the market does not start empty.
   The house demo account lists them: they are not invented people, and their
   references were frozen on their listing date, which the simulator reproduces
   the same way on every reload. */
const HOUSE = [
  { symbol:'MAG5', name:'Magnificent 5', note:'The five heaviest names in the US index.',
    legs:[{id:'NVDA',weight:30},{id:'MSFT',weight:25},{id:'AAPL',weight:20},{id:'GOOGL',weight:15},{id:'AMZN',weight:10}], days:64 },
  { symbol:'SILICON', name:'Silicon', note:'The semiconductor chain, from the GPU to the lithography.',
    legs:[{id:'NVDA',weight:30},{id:'TSM',weight:25},{id:'AVGO',weight:20},{id:'AMD',weight:15},{id:'ASML',weight:10}], days:51 },
  { symbol:'PRECIOUS', name:'Precious metals', note:'Gold and silver by weight, with platinum and palladium behind them.',
    legs:[{id:'XAU',weight:45},{id:'XAG',weight:30},{id:'XPT',weight:15},{id:'XPD',weight:10}], days:73 },
  { symbol:'BATTERY', name:'Battery metals', note:'Lithium, cobalt, copper and nickel: what weighs in a cell.',
    legs:[{id:'XLI',weight:30},{id:'XCO',weight:25},{id:'XCU',weight:25},{id:'XNI',weight:20}], days:38 },
  { symbol:'CRYPTOBETA', name:'Crypto beta', note:'Crypto and the listed companies that hold it on the balance sheet.',
    legs:[{id:'BTC',weight:40},{id:'ETH',weight:25},{id:'COIN',weight:20},{id:'MSTR',weight:15}], days:45 },
  { symbol:'LUXURY', name:'European luxury', note:'Three European houses that sell margin before they sell units.',
    legs:[{id:'MC',weight:40},{id:'FER',weight:35},{id:'ITX',weight:25}], days:29 },
  { symbol:'IBERIA', name:'Iberia', note:'The two banks and the utility that move the Spanish market.',
    legs:[{id:'SAN',weight:35},{id:'BBVA',weight:35},{id:'IBE',weight:30}], days:22 },
  { symbol:'CRAVING', name:'Consumer craving', note:'Brand, recipe and shop window: consumption that repeats.',
    legs:[{id:'KO',weight:25},{id:'MCD',weight:25},{id:'PEP',weight:20},{id:'SBUX',weight:15},{id:'NKE',weight:15}], days:57 },
  { symbol:'GOLDTWICE', name:'Gold two ways', note:'The metal by weight and the ETF that custodies it, in the same basket.',
    legs:[{id:'XAU',weight:45},{id:'GLD',weight:35},{id:'SLV',weight:20}], days:33 },
];

function seedIndices() {
  const now = Date.now();
  return HOUSE.map((h, i) => {
    const listedAt = now - h.days * DAY;
    return {
      id: 'ix_' + h.symbol.toLowerCase(),
      symbol: h.symbol,
      name: h.name,
      note: h.note,
      legs: h.legs,
      refs: snapshotRefs(h.legs, listedAt),
      creator: 'house',
      listedAt,
      feesAccrued: 0,
      feesClaimed: 0,
      order: i,
    };
  });
}

function fresh() {
  return {
    version: 1,
    wallet: { balance: VENUE.openingBalance, openedAt: Date.now() },
    indices: seedIndices(),
    positions: [],
    history: [],
    seq: 1,
  };
}

/** Reads the current key, falling back to the one the application used under
 *  its old name and moving it across, so a rename costs nobody their history. */
function readStored() {
  const parse = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const current = parse(KEY);
  if (current) return current;
  const legacy = parse(LEGACY_KEY);
  if (!legacy) return null;
  try {
    localStorage.setItem(KEY, JSON.stringify(legacy));
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
  return legacy;
}

function load() {
  const raw = readStored();
  if (!raw || raw.version !== 1) return fresh();
  // The house indices are restored if they are missing, without touching the
  // user's own ones or any open position.
  const mine = (raw.indices || []).filter(ix => ix.creator !== 'house');
  const house = (raw.indices || []).filter(ix => ix.creator === 'house');
  return { ...fresh(), ...raw, indices: [...(house.length ? house : seedIndices()), ...mine] };
}

export const state = load();

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  listeners.forEach(fn => { try { fn(state); } catch {} });
}
export function nextId(prefix) { return `${prefix}_${(state.seq++).toString(36)}${Date.now().toString(36).slice(-4)}`; }
export function resetAll() {
  try { localStorage.removeItem(KEY); } catch {}
  Object.assign(state, fresh());
  commit();
}

export const getIndex = (id) => state.indices.find(ix => ix.id === id) || null;
export const openPositions = (indexId) =>
  state.positions.filter(p => !indexId || p.indexId === indexId);
export const myIndices = () => state.indices.filter(ix => ix.creator === 'me');
