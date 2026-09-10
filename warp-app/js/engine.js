/* El motor del mercado: listar un indice, abrir y cerrar posiciones, cobrar
   comisiones, acumular financiacion y liquidar lo que se queda sin margen.

   Las reglas viven en VENUE (config.js), no repartidas por la interfaz, para que
   lo que dice un panel de trading y lo que hace el motor sean la misma regla.
   Todas las funciones devuelven { ok, error } en lugar de lanzar: un formulario
   necesita explicar por que no puede seguir, no romperse. */

import { VENUE } from './config.js';
import { state, commit, nextId, getIndex, openPositions } from './store.js';
import { basketValue, basketChangePct, snapshotRefs, volume24h } from './market.js';
import { getAsset } from './registry.js';

const HOUR = 3600e3;
const round = (v, d = 6) => Math.round(v * 10 ** d) / 10 ** d;

/* -------- listar un indice -------- */

export function validateBasket({ symbol, name, legs }) {
  const errors = [];
  const sym = String(symbol || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,12}$/.test(sym)) errors.push('El simbolo son de 3 a 12 letras o numeros, sin espacios.');
  if (state.indices.some(ix => ix.symbol === sym)) errors.push(`Ya hay un indice listado como ${sym}.`);
  if (!String(name || '').trim()) errors.push('El indice necesita un nombre.');

  const rows = (legs || []).filter(l => l && l.id);
  if (rows.length < VENUE.minLegs) errors.push(`Un indice lleva al menos ${VENUE.minLegs} activos.`);
  if (rows.length > VENUE.maxLegs) errors.push(`Un indice lleva como maximo ${VENUE.maxLegs} activos.`);
  if (new Set(rows.map(l => l.id)).size !== rows.length) errors.push('Hay un activo repetido en el cesto.');
  if (rows.some(l => !getAsset(l.id))) errors.push('Hay un activo que no esta en el registro.');
  if (rows.some(l => !(l.weight > 0))) errors.push('Todo peso tiene que ser mayor que cero.');

  const total = rows.reduce((s, l) => s + (Number(l.weight) || 0), 0);
  if (rows.length && Math.abs(total - 100) > 0.01) {
    errors.push(`Los pesos suman ${total.toFixed(2)} % y tienen que sumar 100 %.`);
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
    creator: 'yo',
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
  if (!ix) return { ok: false, error: 'Ese indice no existe.' };
  if (ix.creator !== 'yo') return { ok: false, error: 'Solo puedes retirar un indice que has listado tu.' };
  if (openPositions(id).length) return { ok: false, error: 'No puedes retirar un indice con posiciones abiertas.' };
  if (pendingFees(ix) > 0) return { ok: false, error: 'Reclama primero las comisiones acumuladas.' };
  state.indices = state.indices.filter(x => x.id !== id);
  commit();
  return { ok: true };
}

/* -------- lectura de un indice -------- */

export const indexValue = (ix, t) => (ix ? basketValue(ix.legs, ix.refs, t, VENUE.indexBase) : null);
export const indexChange = (ix, hours = 24, t) => (ix ? basketChangePct(ix.legs, ix.refs, hours, t) : null);
export const indexLegs = (ix) => (ix?.legs || []).map(l => ({ ...l, asset: getAsset(l.id) }));

/** Interes abierto en el propio mercado: la suma de nocionales de las posiciones
 *  que hay de verdad, separada por lado. */
export function openInterest(indexId) {
  let long = 0, short = 0;
  for (const p of openPositions(indexId)) {
    if (p.side === 'long') long += p.notional; else short += p.notional;
  }
  return { long, short, total: long + short, skew: long + short ? (long - short) / (long + short) : 0 };
}

/** Profundidad de referencia del cesto, heredada del volumen simulado de sus
 *  patas. Es una cifra del simulador, y la interfaz la marca como tal. */
export function simulatedDepth(ix, t) {
  if (!ix) return 0;
  return ix.legs.reduce((s, l) => s + volume24h(l.id, t) * (l.weight / 100), 0);
}

/** Financiacion vigente por cada 8 h. Positiva: pagan los largos. */
export function fundingRate(indexId) {
  const { skew } = openInterest(indexId);
  const raw = VENUE.fundingBase + skew * VENUE.fundingCap;
  return Math.max(-VENUE.fundingCap, Math.min(VENUE.fundingCap, raw));
}

/* -------- posiciones -------- */

export function quoteOrder({ indexId, side, margin, leverage, t = Date.now() }) {
  const ix = getIndex(indexId);
  const m = Number(margin), lv = Number(leverage);
  const entry = indexValue(ix, t);
  const notional = m * lv;
  const fee = notional * VENUE.takerFee;
  const errors = [];

  if (!ix) errors.push('Ese indice no existe.');
  if (side !== 'long' && side !== 'short') errors.push('Elige un lado: largo o corto.');
  if (!(m >= VENUE.minMargin)) errors.push(`El margen minimo es ${VENUE.minMargin} ${VENUE.settle}.`);
  if (!(lv >= 1 && lv <= VENUE.maxLeverage)) errors.push(`El apalancamiento va de 1x a ${VENUE.maxLeverage}x.`);
  if (entry === null) errors.push('El indice no tiene valor calculable ahora mismo.');
  if (m + fee > state.wallet.balance) errors.push(`No te llega el saldo: hacen falta ${(m + fee).toFixed(2)} ${VENUE.settle} con la comision.`);

  return {
    ok: !errors.length, errors, error: errors[0] || null,
    entry, notional, fee, margin: m, leverage: lv,
    liq: entry === null ? null : liquidationPrice(entry, side, lv),
    creatorFee: fee * VENUE.creatorShare,
  };
}

/** Precio al que la posicion se queda sin margen. Del mismo sitio sale el aviso
 *  del formulario y la liquidacion real, asi que no pueden discrepar. */
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

/** Estado vivo de una posicion. Nada de esto se guarda: se calcula del precio. */
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

/** La financiacion se devenga con el tiempo, al tipo vigente. Se calcula desde
 *  la ultima liquidacion de la posicion para no cobrar dos veces el mismo tramo. */
function accruedFunding(pos, t) {
  const hours = Math.max(0, (t - (pos.fundingAt || pos.openedAt)) / HOUR);
  const rate = fundingRate(pos.indexId);
  const paidBySide = pos.side === 'long' ? 1 : -1;
  return round((pos.funding || 0) + pos.notional * rate * (hours / 8) * paidBySide, 8);
}

export function closePosition(id, reason = 'manual') {
  const t = Date.now();
  const i = state.positions.findIndex(p => p.id === id);
  if (i < 0) return { ok: false, error: 'Esa posicion ya no esta abierta.' };
  const pos = state.positions[i];
  const m = markPosition(pos, t);
  if (m.mark === null) return { ok: false, error: 'No se puede cerrar sin valor de indice.' };

  const ix = getIndex(pos.indexId);
  // Una liquidacion se lleva el margen: no devuelve resto ni cobra cierre.
  const returned = reason === 'liquidacion' ? 0 : Math.max(0, m.net);
  const closeFee = reason === 'liquidacion' ? 0 : m.closeFee;

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

/** Barre las posiciones sin margen. La llama el reloj de la aplicacion, asi que
 *  una liquidacion ocurre por la regla y no porque alguien mire la pantalla. */
export function liquidationSweep(t = Date.now()) {
  const dead = state.positions.filter(p => markPosition(p, t).liquidatable);
  dead.forEach(p => closePosition(p.id, 'liquidacion'));
  return dead.length;
}

/* -------- el creador -------- */

export const pendingFees = (ix) => round((ix?.feesAccrued || 0) - (ix?.feesClaimed || 0), 8);

export function claimFees(indexId) {
  const ix = getIndex(indexId);
  if (!ix) return { ok: false, error: 'Ese indice no existe.' };
  if (ix.creator !== 'yo') return { ok: false, error: 'Solo el creador del indice cobra sus comisiones.' };
  const due = pendingFees(ix);
  if (due <= 0) return { ok: false, error: 'No hay comisiones pendientes en este indice.' };
  ix.feesClaimed = round(ix.feesClaimed + due, 8);
  state.wallet.balance = round(state.wallet.balance + due, 8);
  commit();
  return { ok: true, claimed: due };
}

/* -------- la cuenta -------- */

export function accountSummary(t = Date.now()) {
  let marginUsed = 0, unrealised = 0;
  for (const p of state.positions) {
    const m = markPosition(p, t);
    marginUsed += p.margin;
    if (m.mark !== null) unrealised += m.pnl - m.funding;
  }
  const claimable = state.indices.reduce((s, ix) => s + (ix.creator === 'yo' ? pendingFees(ix) : 0), 0);
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
