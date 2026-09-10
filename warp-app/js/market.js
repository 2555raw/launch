/* El feed de precios.

   AVISO, Y ES EL QUE GOBIERNA TODO EL PROYECTO: aqui no hay dato de mercado
   real. Warp es un mercado de practica y el precio lo produce este simulador.
   Los niveles de referencia de abajo son ordenes de magnitud escogidos para que
   la interfaz se lea, no cotizaciones. Ningun numero de esta aplicacion
   describe el mercado real, y la interfaz lo dice en la cabecera y en el pie de
   cada pantalla en lugar de dejarlo en la letra pequena.

   Como funciona: el precio de un activo en un instante es una suma de ondas de
   distinta escala, con fase y amplitud sembradas a partir del simbolo. Eso da
   tres propiedades que un paseo aleatorio no da:
   - es reproducible: la misma semilla da el mismo mercado en cada recarga y en
     cada pestana, asi que una posicion abierta ayer sigue teniendo sentido hoy;
   - es continuo: no hay saltos entre recargas;
   - se puede evaluar en cualquier instante en tiempo constante, asi que el
     historico de un grafico no hay que guardarlo: se calcula.

   Para enchufar un proveedor real mas adelante, esta `setFeed()` al final: la
   aplicacion solo conoce esa interfaz, no este simulador. */

import { config } from './config.js';
import { getAsset } from './registry.js';

/* Niveles de referencia del simulador. No son cotizaciones. */
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

/* Cuanto se mueve cada clase, en relacion a una accion. */
const VOL = { stock:1, etf:0.55, metal:0.85, crypto:2.2, settle:0 };

const MIN = 60e3, HOUR = 3600e3, DAY = 24 * HOUR;
/* Escalas de la onda, de la tendencia de fondo al parpadeo del tick. */
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
    // Cada onda recibe fase propia y la amplitud se despeina un poco, para que
    // dos activos de la misma clase no se muevan calcados.
    waves: WAVES.map(w => ({
      w: (2 * Math.PI) / w.period,
      phase: rnd() * Math.PI * 2,
      amp: w.amp * vol * (0.7 + rnd() * 0.6),
    })),
    // Volumen de referencia del activo, tambien simulado.
    volBase: (0.4 + rnd() * 3.2) * 1e6,
  };
  shapes.set(id, s);
  return s;
}

/** Precio del activo en un instante. Tiempo constante y sin estado. */
export function spot(id, t = Date.now()) {
  const s = shape(id);
  if (!s.vol) return s.base;                     // USDG no se mueve
  let e = 0;
  for (const w of s.waves) e += w.amp * Math.sin(w.w * t + w.phase);
  return s.base * Math.exp(e);
}

/** Variacion porcentual del activo en las ultimas `hours` horas. */
export function changePct(id, hours = 24, t = Date.now()) {
  const then = spot(id, t - hours * HOUR);
  if (!then) return 0;
  return ((spot(id, t) / then) - 1) * 100;
}

/** Serie temporal para el grafico. No se guarda: se evalua. */
export function series(id, from, to, points = 180) {
  const step = (to - from) / Math.max(points - 1, 1);
  const out = [];
  for (let i = 0; i < points; i++) {
    const t = from + i * step;
    out.push({ t, c: spot(id, t) });
  }
  return out;
}

/** Volumen simulado de 24 h del activo, en unidades de liquidacion. */
export function volume24h(id, t = Date.now()) {
  const s = shape(id);
  if (!s.vol) return 0;
  const heat = 1 + Math.abs(changePct(id, 24, t)) / 12;
  const wobble = 0.75 + 0.5 * (0.5 + 0.5 * Math.sin(shape(id).waves[3].w * t + 1.7));
  return s.base * s.volBase * heat * wobble / 1000;
}

/* -------- el cesto --------
   Un indice de peso fijo vale, en base 100 desde el dia que se listo:
       V(t) = 100 * suma_i  w_i * P_i(t) / P_i(t0)
   Los P_i(t0) son las referencias que se congelan al listar el indice, y viven
   en el propio indice. Asi el grafico mide exactamente lo que ha hecho el cesto
   desde que existe, y anadir una pata nueva no reescribe su historia. */

export function basketValue(legs, refs, t = Date.now(), base = 100) {
  let v = 0;
  for (const leg of legs) {
    const ref = refs?.[leg.id];
    if (!ref) return null;                       // sin referencia no hay indice
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

/** Fotografia de las referencias de un cesto en el momento de listarlo. */
export function snapshotRefs(legs, t = Date.now()) {
  const refs = {};
  for (const leg of legs) refs[leg.id] = spot(leg.id, t);
  return refs;
}

/* -------- punto de extension --------
   La aplicacion nunca llama al simulador directamente: llama a estas funciones.
   Un proveedor real se enchufa sustituyendolas, y nada mas de la aplicacion
   cambia. Mientras el feed sea el simulador, `isSimulated` es true y la
   interfaz lo anuncia. */
export const feed = { spot, changePct, series, volume24h, isSimulated: true, label: 'Simulador Warp' };
export function setFeed(next) { Object.assign(feed, next); }
