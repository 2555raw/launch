/* The checks worth having.

   The engine is the only part of this project where a bug pays the wrong
   person, so what is tested here is the promise it makes: the same seed and the
   same field always produce the same winner, a race always ends with a full
   finishing order, and nobody can enter a wallet they cannot sign for.

   node test/engine.test.js */

'use strict';

const assert = require('assert');
const RACE = require('../public/shared/race.js');

let passed = 0;
const queue = [];
function ok(name, fn) {
  queue.push(async () => {
    try { await fn(); console.log('  ok   ' + name); passed++; }
    catch (err) { console.log('  FAIL ' + name + '\n       ' + err.message); process.exitCode = 1; }
  });
}

const field = (n, tag) => [...Array(n)].map((_, i) => ({ id: (tag || 'w') + i }));

console.log('\nrace engine');

ok('the same seed and field give the same race, every time', () => {
  for (const seed of [1, 7, 12345, 987654321]) {
    const a = RACE.runToEnd(seed, field(40));
    const b = RACE.runToEnd(seed, field(40));
    assert.strictEqual(a.order[0].id, b.order[0].id, 'winner drifted');
    assert.deepStrictEqual(a.order, b.order, 'order drifted');
  }
});

ok('a different seed gives a different race', () => {
  const winners = new Set([11, 22, 33, 44, 55, 66].map((s) => RACE.runToEnd(s, field(40)).order[0].id));
  assert(winners.size > 1, 'every seed produced the same winner');
});

ok('every marble is placed, and the field always finishes', () => {
  for (const n of [1, 2, 25, 120, 250]) {
    const r = RACE.runToEnd(4242, field(n));
    assert.strictEqual(r.order.length, n, n + ' marbles in, ' + r.order.length + ' out');
    const places = r.order.map((o) => o.place).sort((a, b) => a - b);
    assert.deepStrictEqual(places, [...Array(n)].map((_, i) => i + 1), 'places are not 1..n');
  }
});

ok('races are over inside the phase they are given', () => {
  for (const seed of [3, 31, 314, 3141, 31415]) {
    const r = RACE.runToEnd(seed, field(60));
    assert(r.seconds <= RACE.MAX_SECONDS + 0.05, 'ran to ' + r.seconds + 's');
    assert(r.order[0].time > 2, 'winner home in ' + r.order[0].time + 's, which is not a race');
  }
});

ok('the leader reaches the line rather than timing out', () => {
  for (const seed of [5, 50, 500, 5000]) {
    const r = RACE.runToEnd(seed, field(30));
    assert(r.order[0].time < RACE.MAX_SECONDS - 1,
      'nobody finished before the clock ran out on seed ' + seed);
  }
});

ok('the lobby never ends, empty or not', () => {
  const held = RACE.createRace(9, [], { hold: true });
  for (let i = 0; i < RACE.MAX_SECONDS * 60 + 300; i++) RACE.step(held);
  assert.strictEqual(held.over, false, 'the lobby called itself finished');
  RACE.addBall(held, 'late');
  for (let i = 0; i < 240; i++) RACE.step(held);
  assert(held.balls[0].y > 100, 'a marble added to the lobby never fell');
});

ok('starting slots are shuffled by the seed, not by join order', () => {
  const a = RACE.createRace(77, field(30));
  const b = RACE.createRace(78, field(30));
  const xa = a.balls.map((m) => Math.round(m.x)).join(',');
  const xb = b.balls.map((m) => Math.round(m.x)).join(',');
  assert.notStrictEqual(xa, xb, 'two seeds laid the grid out identically');
});

ok('no marble is ever left with a broken position', () => {
  const st = RACE.createRace(2024, field(80));
  while (!st.over) {
    RACE.step(st);
    for (const b of st.balls) assert(Number.isFinite(b.x) && Number.isFinite(b.y), 'a marble left the numbers');
  }
});

console.log('\nwallets');

const { ethers } = require('ethers');
const chain = require('../lib/chain');
const wallet = ethers.Wallet.createRandom();
const message = 'MARBLE ROYALE\nsign in\nnonce: abc';

ok('a real signature is accepted', async () => {
  const signature = await wallet.signMessage(message);
  assert.strictEqual(chain.verifySignature(wallet.address, message, signature), true);
  assert.strictEqual(chain.verifySignature(wallet.address.toLowerCase(), message, signature), true);
});

ok('a signature for another message is refused', async () => {
  const signature = await wallet.signMessage(message);
  assert.strictEqual(chain.verifySignature(wallet.address, message + ' ', signature), false);
});

ok('someone else\'s address cannot be claimed', async () => {
  const signature = await wallet.signMessage(message);
  assert.strictEqual(chain.verifySignature(ethers.Wallet.createRandom().address, message, signature), false);
});

ok('rubbish in is refused rather than thrown', async () => {
  const signature = await wallet.signMessage(message);
  for (const bad of ['', '0x12', 'not an address', null, undefined, 42]) {
    assert.strictEqual(chain.verifySignature(bad, message, signature), false);
    assert.strictEqual(chain.verifySignature(wallet.address, message, bad), false);
  }
});

ok('addresses come out checksummed, or not at all', () => {
  assert.strictEqual(chain.normalize(wallet.address.toLowerCase()), wallet.address);
  assert.strictEqual(chain.normalize('So11111111111111111111111111111111111111112'), null);
  assert.strictEqual(chain.isAddress(wallet.address), true);
});

(async () => {
  for (const run of queue) await run();
  console.log('\n' + passed + ' checks passed\n');
})();
