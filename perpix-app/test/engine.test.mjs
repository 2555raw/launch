/* The market's rules, checked without a browser.
   Run with:  node perpix-app/test/engine.test.mjs
   What is tested here is what cannot be wrong: that a basket starts at its
   base, that the legs' contributions add up to the index's change, that the
   balance reconciles after every trade, and that a limit is a limit. */

// The modules keep state in the browser; outside it, a stub that stores nothing
// is enough, because every run starts from a fresh account.
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
let ran = 0, fails = 0;
const ok = (name, cond, extra = '') => {
  ran++;
  if (!cond) fails++;
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${name}${cond ? '' : '  ' + extra}`);
};

const { VENUE } = await import('../js/config.js');
const M = await import('../js/market.js');
const S = await import('../js/store.js');
const E = await import('../js/engine.js');

// --- the simulator: reproducible and continuous ---
const t0 = Date.now();
ok('spot is deterministic', M.spot('NVDA', t0) === M.spot('NVDA', t0));
ok('spot is continuous', Math.abs(M.spot('BTC', t0) / M.spot('BTC', t0 + 1000) - 1) < 0.001);
ok('every asset has a positive price',
  [...(await import('../js/registry.js')).ASSETS].every(a => M.spot(a.id, t0) > 0));
ok('USDG does not move', M.spot('USDG', t0) === 1 && M.spot('USDG', t0 + 9e8) === 1);

// --- the basket ---
const legs = [{ id: 'XAU', weight: 50 }, { id: 'NVDA', weight: 30 }, { id: 'BTC', weight: 20 }];
const refs = M.snapshotRefs(legs, t0);
ok('a basket is worth its base the day it lists', near(M.basketValue(legs, refs, t0), 100, 1e-9),
  String(M.basketValue(legs, refs, t0)));
// the legs' contributions add up to the index's change
const t1 = t0 + 7 * 86400e3;
const v1 = M.basketValue(legs, refs, t1);
const suma = legs.reduce((s, l) => s + (M.spot(l.id, t1) / refs[l.id] - 1) * (l.weight / 100), 0) * 100;
ok('contributions add up to the index change', near(v1 - 100, suma, 1e-9), `${v1 - 100} vs ${suma}`);
ok('no reference means no value', M.basketValue([{ id: 'XAU', weight: 100 }], {}, t0) === null);

// --- basket validation ---
const v = (o) => E.validateBasket(o);
ok('rejects fewer than three legs', !v({ symbol: 'AAA', name: 'x', legs: [{ id: 'XAU', weight: 100 }] }).ok);
ok('rejects more than five legs', !v({ symbol: 'AAA', name: 'x', legs: 'XAU XAG XPT XPD XCU XAL'.split(' ').map(id => ({ id, weight: 100 / 6 })) }).ok);
ok('rejects weights that do not add up to 100', !v({ symbol: 'AAA', name: 'x', legs: [{ id: 'XAU', weight: 50 }, { id: 'XAG', weight: 20 }, { id: 'XPT', weight: 20 }] }).ok);
ok('rejects a repeated leg', !v({ symbol: 'AAA', name: 'x', legs: [{ id: 'XAU', weight: 40 }, { id: 'XAU', weight: 30 }, { id: 'XAG', weight: 30 }] }).ok);
ok('rejects a symbol with spaces', !v({ symbol: 'A B', name: 'x', legs: [{ id: 'XAU', weight: 40 }, { id: 'XAG', weight: 30 }, { id: 'XPT', weight: 30 }] }).ok);
ok('rejects a symbol already listed', !v({ symbol: 'MAG5', name: 'x', legs: [{ id: 'XAU', weight: 40 }, { id: 'XAG', weight: 30 }, { id: 'XPT', weight: 30 }] }).ok);
const good = { symbol: 'PRUEBA', name: 'Cesto de prueba', legs: [{ id: 'XAU', weight: 40 }, { id: 'XAG', weight: 30 }, { id: 'NVDA', weight: 30 }] };
ok('accepts a valid basket', v(good).ok, JSON.stringify(v(good).errors));

// --- listing ---
const listed = E.listIndex(good);
ok('lists the index', listed.ok, listed.error);
const ix = listed.index;
ok('starts at base 100', near(E.indexValue(ix, ix.listedAt), 100, 1e-9));
ok('the creator is the user', ix.creator === 'me');

// --- liquidation price ---
const lp = E.liquidationPrice(100, 'long', 5);
ok('liquidation of a 5x long', near(lp, 100 * (1 - 1 / 5 + VENUE.maintenanceMargin)), String(lp));
ok('liquidation of a 5x short', near(E.liquidationPrice(100, 'short', 5), 100 * (1 + 1 / 5 - VENUE.maintenanceMargin)));
ok('at 1x a long liquidates near zero', E.liquidationPrice(100, 'long', 1) < 1);

// --- opening a position ---
const before = S.state.wallet.balance;
const q = E.quoteOrder({ indexId: ix.id, side: 'long', margin: 200, leverage: 3 });
ok('the quote gets the notional right', near(q.notional, 600));
ok('the fee is 0.05% of notional', near(q.fee, 600 * VENUE.takerFee));
ok('the creator gets 30%', near(q.creatorFee, q.fee * VENUE.creatorShare));
const opened = E.openPosition({ indexId: ix.id, side: 'long', margin: 200, leverage: 3 });
ok('opens the position', opened.ok, opened.error);
ok('the balance drops by margin plus fee', near(S.state.wallet.balance, before - 200 - q.fee, 1e-6),
  `${S.state.wallet.balance} vs ${before - 200 - q.fee}`);
ok('the fee accrues to the creator', near(E.pendingFees(S.getIndex(ix.id)), q.fee * VENUE.creatorShare, 1e-6));
ok('the index sees the open interest', near(E.openInterest(ix.id).long, 600));
ok('funding tilts towards the longs', E.fundingRate(ix.id) > 0);

// --- result and liquidation ---
const pos = S.state.positions[0];
const m = E.markPosition(pos, Date.now());
ok('the result is notional times the move',
  near(m.pnl, pos.notional * (m.mark / pos.entry - 1), 1e-9));
ok('maintenance margin decides liquidation', typeof m.liquidatable === 'boolean');
// a position whose mark falls below its liquidation has to be liquidatable
const falsa = { ...pos, entry: m.mark / (1 - 1 / pos.leverage), funding: 0, fundingAt: Date.now() };
ok('below liquidation it is liquidatable', E.markPosition(falsa, Date.now()).liquidatable);

// --- closing ---
const antes = S.state.wallet.balance;
const closed = E.closePosition(pos.id);
ok('closes the position', closed.ok, closed.error);
ok('no open positions are left', S.state.positions.length === 0);
ok('the history records it', S.state.history[0]?.id === pos.id);
ok('the balance rises by what was returned', near(S.state.wallet.balance, antes + closed.closed.returned, 1e-6));
ok('closing twice does not work', !E.closePosition(pos.id).ok);

// --- claiming fees ---
const ix2 = S.getIndex(ix.id);
const due = E.pendingFees(ix2);
ok('fees are pending after trading', due > 0, String(due));
const bal = S.state.wallet.balance;
const claim = E.claimFees(ix.id);
ok('claims the fees', claim.ok && near(claim.claimed, due, 1e-9), claim.error);
ok('the balance rises by what was claimed', near(S.state.wallet.balance, bal + due, 1e-6));
ok('fees cannot be claimed twice', !E.claimFees(ix.id).ok);
ok("someone else's index cannot be claimed", !E.claimFees('ix_mag5').ok);

// --- delisting ---
ok('delists an index with no positions and nothing pending', E.delistIndex(ix.id).ok);
ok('a house index cannot be delisted', !E.delistIndex('ix_mag5').ok);

// --- limits ---
ok('rejects leverage above the maximum',
  !E.quoteOrder({ indexId: 'ix_mag5', side: 'long', margin: 100, leverage: VENUE.maxLeverage + 1 }).ok);
ok('rejects margin below the minimum',
  !E.quoteOrder({ indexId: 'ix_mag5', side: 'long', margin: 1, leverage: 2 }).ok);
ok('rejects margin the balance cannot cover',
  !E.quoteOrder({ indexId: 'ix_mag5', side: 'long', margin: S.state.wallet.balance * 2, leverage: 2 }).ok);
ok('rejects a made-up side',
  !E.quoteOrder({ indexId: 'ix_mag5', side: 'lateral', margin: 100, leverage: 2 }).ok);

console.log(fails
  ? `\n${fails} of ${ran} checks fail`
  : `\nall ${ran} checks pass`);
process.exit(fails ? 1 : 0);
