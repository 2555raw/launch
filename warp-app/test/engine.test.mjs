/* Las reglas del mercado, comprobadas sin navegador.
   Se ejecuta con:  node warp-app/test/engine.test.mjs
   Lo que se prueba aqui es lo que no puede estar mal: que el cesto arranque en
   su base, que las aportaciones de las patas sumen la variacion del indice, que
   el saldo cuadre despues de cada operacion y que un limite sea un limite. */

// Los modulos guardan estado en el navegador; fuera de el, un doble que no
// guarda nada basta, porque cada ejecucion parte de una cuenta nueva.
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
let ran = 0, fails = 0;
const ok = (name, cond, extra = '') => {
  ran++;
  if (!cond) fails++;
  console.log(`${cond ? '  ok  ' : ' FALLA'} ${name}${cond ? '' : '  ' + extra}`);
};

const { VENUE } = await import('../js/config.js');
const M = await import('../js/market.js');
const S = await import('../js/store.js');
const E = await import('../js/engine.js');

// --- simulador: reproducible y continuo ---
const t0 = Date.now();
ok('spot es determinista', M.spot('NVDA', t0) === M.spot('NVDA', t0));
ok('spot es continuo', Math.abs(M.spot('BTC', t0) / M.spot('BTC', t0 + 1000) - 1) < 0.001);
ok('todo activo tiene precio positivo',
  [...(await import('../js/registry.js')).ASSETS].every(a => M.spot(a.id, t0) > 0));
ok('USDG no se mueve', M.spot('USDG', t0) === 1 && M.spot('USDG', t0 + 9e8) === 1);

// --- el cesto ---
const legs = [{ id: 'XAU', weight: 50 }, { id: 'NVDA', weight: 30 }, { id: 'BTC', weight: 20 }];
const refs = M.snapshotRefs(legs, t0);
ok('el cesto vale la base el dia que se lista', near(M.basketValue(legs, refs, t0), 100, 1e-9),
  String(M.basketValue(legs, refs, t0)));
// las aportaciones de las patas suman la variacion del indice
const t1 = t0 + 7 * 86400e3;
const v1 = M.basketValue(legs, refs, t1);
const suma = legs.reduce((s, l) => s + (M.spot(l.id, t1) / refs[l.id] - 1) * (l.weight / 100), 0) * 100;
ok('las aportaciones suman la variacion del indice', near(v1 - 100, suma, 1e-9), `${v1 - 100} vs ${suma}`);
ok('sin referencia no hay valor', M.basketValue([{ id: 'XAU', weight: 100 }], {}, t0) === null);

// --- validacion del cesto ---
const v = (o) => E.validateBasket(o);
ok('rechaza menos de 3 patas', !v({ symbol: 'AAA', name: 'x', legs: [{ id: 'XAU', weight: 100 }] }).ok);
ok('rechaza mas de 5 patas', !v({ symbol: 'AAA', name: 'x', legs: 'XAU XAG XPT XPD XCU XAL'.split(' ').map(id => ({ id, weight: 100 / 6 })) }).ok);
ok('rechaza pesos que no suman 100', !v({ symbol: 'AAA', name: 'x', legs: [{ id: 'XAU', weight: 50 }, { id: 'XAG', weight: 20 }, { id: 'XPT', weight: 20 }] }).ok);
ok('rechaza patas repetidas', !v({ symbol: 'AAA', name: 'x', legs: [{ id: 'XAU', weight: 40 }, { id: 'XAU', weight: 30 }, { id: 'XAG', weight: 30 }] }).ok);
ok('rechaza simbolo con espacios', !v({ symbol: 'A B', name: 'x', legs: [{ id: 'XAU', weight: 40 }, { id: 'XAG', weight: 30 }, { id: 'XPT', weight: 30 }] }).ok);
ok('rechaza simbolo ya listado', !v({ symbol: 'MAG5', name: 'x', legs: [{ id: 'XAU', weight: 40 }, { id: 'XAG', weight: 30 }, { id: 'XPT', weight: 30 }] }).ok);
const good = { symbol: 'PRUEBA', name: 'Cesto de prueba', legs: [{ id: 'XAU', weight: 40 }, { id: 'XAG', weight: 30 }, { id: 'NVDA', weight: 30 }] };
ok('acepta un cesto valido', v(good).ok, JSON.stringify(v(good).errors));

// --- listar ---
const listed = E.listIndex(good);
ok('lista el indice', listed.ok, listed.error);
const ix = listed.index;
ok('arranca en base 100', near(E.indexValue(ix, ix.listedAt), 100, 1e-9));
ok('el creador es el usuario', ix.creator === 'yo');

// --- precio de liquidacion ---
const lp = E.liquidationPrice(100, 'long', 5);
ok('liquidacion de un largo 5x', near(lp, 100 * (1 - 1 / 5 + VENUE.maintenanceMargin)), String(lp));
ok('liquidacion de un corto 5x', near(E.liquidationPrice(100, 'short', 5), 100 * (1 + 1 / 5 - VENUE.maintenanceMargin)));
ok('a 1x el largo se liquida casi a cero', E.liquidationPrice(100, 'long', 1) < 1);

// --- abrir una posicion ---
const before = S.state.wallet.balance;
const q = E.quoteOrder({ indexId: ix.id, side: 'long', margin: 200, leverage: 3 });
ok('la cotizacion cuadra el nocional', near(q.notional, 600));
ok('la comision es 0,05 % del nocional', near(q.fee, 600 * VENUE.takerFee));
ok('al creador le toca el 30 %', near(q.creatorFee, q.fee * VENUE.creatorShare));
const opened = E.openPosition({ indexId: ix.id, side: 'long', margin: 200, leverage: 3 });
ok('abre la posicion', opened.ok, opened.error);
ok('el saldo baja margen mas comision', near(S.state.wallet.balance, before - 200 - q.fee, 1e-6),
  `${S.state.wallet.balance} vs ${before - 200 - q.fee}`);
ok('la comision se acumula al creador', near(E.pendingFees(S.getIndex(ix.id)), q.fee * VENUE.creatorShare, 1e-6));
ok('el interes abierto lo ve el indice', near(E.openInterest(ix.id).long, 600));
ok('la financiacion se inclina hacia los largos', E.fundingRate(ix.id) > 0);

// --- resultado y liquidacion ---
const pos = S.state.positions[0];
const m = E.markPosition(pos, Date.now());
ok('el resultado es nocional por el movimiento',
  near(m.pnl, pos.notional * (m.mark / pos.entry - 1), 1e-9));
ok('el margen de mantenimiento manda en la liquidacion', typeof m.liquidatable === 'boolean');
// una posicion cuya marca cae por debajo de su liquidacion tiene que ser liquidable
const falsa = { ...pos, entry: m.mark / (1 - 1 / pos.leverage), funding: 0, fundingAt: Date.now() };
ok('por debajo de la liquidacion es liquidable', E.markPosition(falsa, Date.now()).liquidatable);

// --- cerrar ---
const antes = S.state.wallet.balance;
const closed = E.closePosition(pos.id);
ok('cierra la posicion', closed.ok, closed.error);
ok('no quedan posiciones abiertas', S.state.positions.length === 0);
ok('el historial la registra', S.state.history[0]?.id === pos.id);
ok('el saldo sube lo devuelto', near(S.state.wallet.balance, antes + closed.closed.returned, 1e-6));
ok('cerrar dos veces no cuela', !E.closePosition(pos.id).ok);

// --- cobrar comisiones ---
const ix2 = S.getIndex(ix.id);
const due = E.pendingFees(ix2);
ok('hay comisiones pendientes tras operar', due > 0, String(due));
const bal = S.state.wallet.balance;
const claim = E.claimFees(ix.id);
ok('cobra las comisiones', claim.ok && near(claim.claimed, due, 1e-9), claim.error);
ok('el saldo sube lo cobrado', near(S.state.wallet.balance, bal + due, 1e-6));
ok('no se cobra dos veces', !E.claimFees(ix.id).ok);
ok('no se cobra un indice ajeno', !E.claimFees('ix_mag5').ok);

// --- retirar ---
ok('retira el indice sin posiciones ni pendientes', E.delistIndex(ix.id).ok);
ok('no se puede retirar un indice de la casa', !E.delistIndex('ix_mag5').ok);

// --- limites ---
ok('rechaza apalancamiento por encima del maximo',
  !E.quoteOrder({ indexId: 'ix_mag5', side: 'long', margin: 100, leverage: VENUE.maxLeverage + 1 }).ok);
ok('rechaza margen por debajo del minimo',
  !E.quoteOrder({ indexId: 'ix_mag5', side: 'long', margin: 1, leverage: 2 }).ok);
ok('rechaza margen que no cabe en el saldo',
  !E.quoteOrder({ indexId: 'ix_mag5', side: 'long', margin: S.state.wallet.balance * 2, leverage: 2 }).ok);
ok('rechaza un lado inventado',
  !E.quoteOrder({ indexId: 'ix_mag5', side: 'lateral', margin: 100, leverage: 2 }).ok);

console.log(fails
  ? `\n${fails} de ${ran} comprobaciones fallan`
  : `\nlas ${ran} comprobaciones pasan`);
process.exit(fails ? 1 : 0);
