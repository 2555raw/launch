/* Configuracion en tiempo de ejecucion, y los parametros del mercado en un solo
   sitio para que la interfaz y el motor no puedan discrepar sobre las reglas. */

export const VENUE = {
  name: 'Warp',
  tagline: 'Perpetuos de indices',
  settle: 'USDG',
  /** Un cesto es de peso fijo y de tres a cinco patas: menos no es un indice,
   *  y mas diluye tanto el peso que el cesto deja de decir nada. */
  minLegs: 3,
  maxLegs: 5,
  maxLeverage: 5,
  /** Comision de apertura y de cierre, sobre el nocional. */
  takerFee: 0.0005,
  /** Del total de comisiones que paga una posicion, esto va al creador del
   *  indice. El resto lo retiene el protocolo. */
  creatorShare: 0.30,
  /** Margen de mantenimiento: por debajo de esto la posicion se liquida. */
  maintenanceMargin: 0.005,
  /** Financiacion de referencia por cada 8 h, escalada por el desequilibrio
   *  entre largos y cortos. */
  fundingBase: 0.0001,
  fundingCap: 0.00075,
  /** Saldo de practica con el que arranca una cuenta nueva. */
  openingBalance: 10000,
  minMargin: 10,
  /** El indice arranca en base 100 el dia que se lista, asi que su grafico mide
   *  exactamente lo que ha hecho el cesto desde entonces. */
  indexBase: 100,
};

/* Los logos oficiales se resuelven del dominio propio de cada entidad en tiempo
   de ejecucion. No se guarda ninguna copia en el repositorio, asi que un logo no
   puede quedarse obsoleto ni divergir entre pantallas. */
const KEY = 'warp.config';
const DEFAULTS = {
  logoTemplate: 'https://img.logo.dev/{domain}?token={logoToken}&size=128&format=png&retries=0',
  logoToken: '',
  /* Resolutores de reserva, en orden. Ninguno pide clave, asi que la aplicacion
     muestra logos reales sin configurar nada; el de pago solo mejora cobertura
     y resolucion cuando hay token. */
  logoFallbacks: [
    'https://icons.duckduckgo.com/ip3/{domain}.ico',
    'https://www.google.com/s2/favicons?domain={domain}&sz=128',
  ],
  /** Semilla del simulador de precios. Fijarla hace que el mercado sea
   *  reproducible entre recargas y entre pestanas. */
  seed: 20260910,
};

/* Se lee del anfitrion si lo hay y del navegador si lo hay: los modulos no dan
   por hecho que existe un navegador, para que la logica se pueda ejecutar y
   probar fuera de uno. */
const host = () => (typeof window === 'undefined' ? null : window.WARP_CONFIG);
function read() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { saved = {}; }
  return { ...DEFAULTS, ...(host() || {}), ...saved };
}
export const config = read();
export function saveConfig(patch) {
  const next = { ...read(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  Object.assign(config, next);
  return config;
}
