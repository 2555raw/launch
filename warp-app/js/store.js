/* El estado del mercado: cartera, indices listados y posiciones.

   Esto si es dato real, dentro de los limites de la aplicacion: lo que hay aqui
   ha pasado de verdad porque lo ha hecho el usuario. El precio es simulado, pero
   una posicion abierta, una comision cobrada o un indice listado son hechos, y
   por eso persisten y se pueden auditar.

   Un solo objeto, una sola clave de almacenamiento y un solo evento de cambio,
   asi que ninguna pantalla puede pintar un saldo que ya no existe. */

import { VENUE } from './config.js';
import { snapshotRefs } from './market.js';

const KEY = 'warp.state.v1';
const DAY = 86400e3;

/* Indices ya listados cuando llegas, para que el mercado no arranque vacio.
   Los lista la cuenta demo de la casa: no son personas inventadas, y sus
   referencias se congelaron en su fecha de listado, que el simulador reproduce
   igual en cada recarga. */
const HOUSE = [
  { symbol:'MAG5', name:'Magnificos 5', note:'Las cinco de mayor peso del indice estadounidense.',
    legs:[{id:'NVDA',weight:30},{id:'MSFT',weight:25},{id:'AAPL',weight:20},{id:'GOOGL',weight:15},{id:'AMZN',weight:10}], days:64 },
  { symbol:'SILICIO', name:'Silicio', note:'La cadena del semiconductor, de la GPU a la litografia.',
    legs:[{id:'NVDA',weight:30},{id:'TSM',weight:25},{id:'AVGO',weight:20},{id:'AMD',weight:15},{id:'ASML',weight:10}], days:51 },
  { symbol:'PRECIOSOS', name:'Metales preciosos', note:'Oro y plata al peso, con platino y paladio de cola.',
    legs:[{id:'XAU',weight:45},{id:'XAG',weight:30},{id:'XPT',weight:15},{id:'XPD',weight:10}], days:73 },
  { symbol:'BATERIA', name:'Metales de bateria', note:'Litio, cobalto, niquel y cobre: lo que pesa en una celda.',
    legs:[{id:'XLI',weight:30},{id:'XCO',weight:25},{id:'XCU',weight:25},{id:'XNI',weight:20}], days:38 },
  { symbol:'BETACRIPTO', name:'Beta cripto', note:'Cripto y las cotizadas que la llevan en balance.',
    legs:[{id:'BTC',weight:40},{id:'ETH',weight:25},{id:'COIN',weight:20},{id:'MSTR',weight:15}], days:45 },
  { symbol:'LUJO', name:'Lujo europeo', note:'Tres casas europeas que venden margen antes que unidades.',
    legs:[{id:'MC',weight:40},{id:'FER',weight:35},{id:'ITX',weight:25}], days:29 },
  { symbol:'IBERIA', name:'Iberia', note:'Los dos bancos y la electrica que mueven el mercado espanol.',
    legs:[{id:'SAN',weight:35},{id:'BBVA',weight:35},{id:'IBE',weight:30}], days:22 },
  { symbol:'ANTOJO', name:'Consumo de antojo', note:'Marca, receta y escaparate: consumo que se repite.',
    legs:[{id:'KO',weight:25},{id:'MCD',weight:25},{id:'PEP',weight:20},{id:'SBUX',weight:15},{id:'NKE',weight:15}], days:57 },
  { symbol:'ORODOBLE', name:'Oro por dos vias', note:'El metal al peso y el ETF que lo custodia, en el mismo cesto.',
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
      creator: 'casa',
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

function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { raw = null; }
  if (!raw || raw.version !== 1) return fresh();
  // Los indices de la casa se reponen si faltan, sin tocar los del usuario ni
  // las posiciones abiertas.
  const mine = (raw.indices || []).filter(ix => ix.creator !== 'casa');
  const house = (raw.indices || []).filter(ix => ix.creator === 'casa');
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
export const myIndices = () => state.indices.filter(ix => ix.creator === 'yo');
