/* The market's engine: list an index, open and close positions, charge fees,
   accrue funding and liquidate whatever runs out of margin.

   The rules live in VENUE (config.js), not scattered across the interface, so
   that what a trading panel says and what the engine does are the same rule.
   Every function returns { ok, error } instead of throwing: a form needs to
   explain why it cannot continue, not break. */

import { VENUE } from './config.js';
import { state, commit, nextId, getIndex, openPositions } from './store.js';
import { basketValue, basketChangePct, snapshotRefs, volume24h } from './market.js';
import { getAsset } from './registry.js';

const HOUR = 3600e3;
const round = (v, d = 6) => Math.round(v * 10 ** d) / 10 ** d;

/* -------- listing an index -------- */

export function validateBasket({ symbol, name, legs }) {
  const errors = [];
  const sym = String(symbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,12}$/.test(sym)) errors.push('A symbol is 3 to 12 letters or digits, with no spaces.');
  if (state.indices.some(ix => ix.symbol === sym)) errors.push(`There is already an index listed as ${sym}.`);
  if (!String(name || '').trim()) errors.push('The index needs a name.');

  const rows = (legs || []).filter(l => l && l.id);
  if (rows.length < VENUE.minLegs) errors.push(`An index holds at least ${VENUE.minLegs} assets.`);
  if (rows.length > VENUE.maxLegs) errors.push(`An index holds at most ${VENUE.maxLegs} assets.`);
  if (new Set(rows.map(l => l.id)).size !== rows.length) errors.push('An asset appears twice in the basket.');
  if (rows.some(l => !getAsset(l.id))) errors.push('An asset is not in the registry.');
  if (rows.some(l => !(l.weight > 0))) errors.push('Every weight has to be greater than zero.');

  const total = rows.reduce((s, l) => s + (Number(l.weight) || 0), 0);
  if (rows.length && Math.abs(total - 100) > 0.01) {
    errors.push(`The weights add up to ${total.toFixed(2)}% and have to add up to 100%.`);
  }
  return { ok: !errors.length, errors, total, symbol: sym };
}

export function listIndex({ symbol, name, note, legs }) {
  const check = validateBasket({ symbol, name, legs });
  if (!check.ok) return { ok: false, error: check.errors[0], errors: check.errors };

  const listedAt = Date.now();
  const clean = legs.map(l => ({ id: l.id, weight: round(Number(l.weight), 4) }));
  const ix = {
    id: nextId('ix'),
    symbol: check.symbol,
    name: String(name).trim(),
    note: String(note || '').trim(),
    legs: clean,
    refs: snapshotRefs(clean, listedAt),
    creator: 'me',
    listedAt,
    feesAccrued: 0,
    feesClaimed: 0,
  };
  state.indices.push(ix);
  commit();
  return { ok: true, index: ix };
}

export function delistIndex(id) {
  const ix = getIndex(id);
  if (!ix) return { ok: false, error: 'That index does not exist.' };
  if (ix.creator !== 'me') return { ok: false, error: 'You can only delist an index you listed yourself.' };
  if (openPositions(id).length) return { ok: false, error: 'You cannot delist an index with open positions.' };
  if (pendingFees(ix) > 0) return { ok: false, error: 'Claim the accrued fees first.' };
  state.indices = state.indices.filter(x => x.id !== id);
  commit();
  return { ok: true };
}

/* -------- reading an index -------- */

export const indexValue = (ix, t) => (ix ? basketValue(ix.legs, ix.refs, t, VENUE.indexBase) : null);
export const indexChange = (ix, hours = 24, t) => (ix ? basketChangePct(ix.legs, ix.refs, hours, t) : null);
export const indexLegs = (ix) => (ix?.legs || []).map(l => ({ ...l, asset: getAsset(l.id) }));

/** Open interest in the market itself: the sum of the notionals of the
 *  positions that actually exist, split by side. */
export function openInterest(indexId) {
  let long = 0, short = 0;
  for (const p of openPositions(indexId)) {
    if (p.side === 'long') long += p.notional; else short += p.notional;
  }
  return { long, short, total: long + short, skew: long + short ? (long - short) / (long + short) : 0 };
}

/** The basket's reference depth, inherited from the simulated volume of its
 *  legs. It is a simulator figure, and the interface marks it as one. */
export function simulatedDepth(ix, t) {
  if (!ix) return 0;
  return ix.legs.reduce((s, l) => s + volume24h(l.id, t) * (l.weight / 100), 0);
}

/** Funding in force per 8 h. Positive: longs pay. */
export function fundingRate(indexId) {
  const { skew } = openInterest(indexId);
  const raw = VENUE.fundingBase + skew * VENUE.fundingCap;
  return Math.max(-VENUE.fundingCap, Math.min(VENUE.fundingCap, raw));
}

/* -------- positions -------- */

export function quoteOrder({ indexId, side, margin, leverage, t = Date.now() }) {
  const ix = getIndex(indexId);
  const m = Number(margin), lv = Number(leverage);
  const entry = indexValue(ix, t);
  const notional = m * lv;
  const fee = notional * VENUE.takerFee;
  const errors = [];

  if (!ix) errors.push('That index does not exist.');
  if (side !== 'long' && side !== 'short') errors.push('Pick a side: long or short.');
  if (!(m >= VENUE.minMargin)) errors.push(`The minimum margin is ${VENUE.minMargin} ${VENUE.settle}.`);
  if (!(lv >= 1 && lv <= VENUE.maxLeverage)) errors.push(`Leverage runs from 1x to ${VENUE.maxLeverage}x.`);
  if (entry === null) errors.push('The index has no computable value right now.');
  if (m + fee > state.wallet.balance) errors.push(`Not enough balance: ${(m + fee).toFixed(2)} ${VENUE.settle} is needed with the fee.`);

  return {
    ok: !errors.length, errors, error: errors[0] || null,
    entry, notional, fee, margin: m, leverage: lv,
    liq: entry === null ? null : liquidationPrice(entry, side, lv),
    creatorFee: fee * VENUE.creatorShare,
  };
}

/** The price at which a position runs out of margin. The form's warning and
 *  the real liquidation come from here, so they cannot disagree. */
export function liquidationPrice(entry, side, leverage) {
  const room = 1 / leverage - VENUE.maintenanceMargin;
  return side === 'long' ? entry * (1 - room) : entry * (1 + room);
}

export function openPosition({ indexId, side, margin, leverage }) {
  const t = Date.now();
  const q = quoteOrder({ indexId, side, margin, leverage, t });
  if (!q.ok) return { ok: false, error: q.error, errors: q.errors };
  const ix = getIndex(indexId);

  state.wallet.balance = round(state.wallet.balance - q.margin - q.fee, 8);
  ix.feesAccrued = round(ix.feesAccrued + q.creatorFee, 8);

  const pos = {
    id: nextId('po'),
    indexId, side,
    margin: round(q.margin, 8),
    leverage: q.leverage,
    notional: round(q.notional, 8),
    entry: q.entry,
    openedAt: t,
    feesPaid: round(q.fee, 8),
    funding: 0,
    fundingAt: t,
  };
  state.positions.push(pos);
  commit();
  return { ok: true, position: pos };
}

/** A position's live state. None of it is stored: it is computed from price. */
export function markPosition(pos, t = Date.now()) {
  const ix = getIndex(pos.indexId);
  const mark = indexValue(ix, t);
  if (mark === null) return { mark: null };
  const move = (mark / pos.entry - 1) * (pos.side === 'long' ? 1 : -1);
  const pnl = pos.notional * move;
  const funding = accruedFunding(pos, t);
  const equity = pos.margin + pnl - funding;
  const closeFee = pos.notional * VENUE.takerFee;
  return {
    ix, mark, move: move * 100, pnl,
    funding,
    equity,
    roe: pos.margin ? ((pnl - funding) / pos.margin) * 100 : null,
    marginRatio: pos.notional ? equity / pos.notional : null,
    liq: liquidationPrice(pos.entry, pos.side, pos.leverage),
    closeFee,
    net: equity - closeFee,
    liquidatable: pos.notional ? equity / pos.notional <= VENUE.maintenanceMargin : false,
  };
}

/** Funding accrues over time at the rate in force. It is measured from the
 *  position's last settlement so the same stretch is never charged twice. */
function accruedFunding(pos, t) {
  const hours = Math.max(0, (t - (pos.fundingAt || pos.openedAt)) / HOUR);
  const rate = fundingRate(pos.indexId);
  const paidBySide = pos.side === 'long' ? 1 : -1;
  return round((pos.funding || 0) + pos.notional * rate * (hours / 8) * paidBySide, 8);
}

export function closePosition(id, reason = 'manual') {
  const t = Date.now();
  const i = state.positions.findIndex(p => p.id === id);
  if (i < 0) return { ok: false, error: 'That position is no longer open.' };
  const pos = state.positions[i];
  const m = markPosition(pos, t);
  if (m.mark === null) return { ok: false, error: 'A position cannot be closed without an index value.' };

  const ix = getIndex(pos.indexId);
  // A liquidation takes the margin: it returns no remainder and charges no
  // closing fee.
  const returned = reason === 'liquidation' ? 0 : Math.max(0, m.net);
  const closeFee = reason === 'liquidation' ? 0 : m.closeFee;

  state.wallet.balance = round(state.wallet.balance + returned, 8);
  if (ix && closeFee) ix.feesAccrued = round(ix.feesAccrued + closeFee * VENUE.creatorShare, 8);

  state.positions.splice(i, 1);
  state.history.unshift({
    ...pos,
    closedAt: t, exit: m.mark, reason,
    pnl: round(m.pnl, 8),
    fundingTotal: round(m.funding, 8),
    feesTotal: round(pos.feesPaid + closeFee, 8),
    returned: round(returned, 8),
    roe: m.roe,
  });
  state.history = state.history.slice(0, 200);
  commit();
  return { ok: true, closed: state.history[0] };
}

/** Sweeps the positions with no margin left. The application's clock calls it,
 *  so a liquidation happens by the rule and not because someone is watching. */
export function liquidationSweep(t = Date.now()) {
  const dead = state.positions.filter(p => markPosition(p, t).liquidatable);
  dead.forEach(p => closePosition(p.id, 'liquidation'));
  return dead.length;
}

/* -------- the creator -------- */

export const pendingFees = (ix) => round((ix?.feesAccrued || 0) - (ix?.feesClaimed || 0), 8);

export function claimFees(indexId) {
  const ix = getIndex(indexId);
  if (!ix) return { ok: false, error: 'That index does not exist.' };
  if (ix.creator !== 'me') return { ok: false, error: "Only an index's creator claims its fees." };
  const due = pendingFees(ix);
  if (due <= 0) return { ok: false, error: 'There are no fees pending on this index.' };
  ix.feesClaimed = round(ix.feesClaimed + due, 8);
  state.wallet.balance = round(state.wallet.balance + due, 8);
  commit();
  return { ok: true, claimed: due };
}

/* -------- the account -------- */

export function accountSummary(t = Date.now()) {
  let marginUsed = 0, unrealised = 0;
  for (const p of state.positions) {
    const m = markPosition(p, t);
    marginUsed += p.margin;
    if (m.mark !== null) unrealised += m.pnl - m.funding;
  }
  const claimable = state.indices.reduce((s, ix) => s + (ix.creator === 'me' ? pendingFees(ix) : 0), 0);
  const realised = state.history.reduce((s, h) => s + (h.pnl || 0), 0);
  return {
    balance: state.wallet.balance,
    marginUsed,
    unrealised,
    equity: state.wallet.balance + marginUsed + unrealised,
    claimable,
    realised,
    open: state.positions.length,
  };
}
