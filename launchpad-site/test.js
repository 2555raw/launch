/* Pruebas de la API: arrancan el servidor en un puerto libre con un directorio
   de datos temporal, entran con una cartera real (clave generada al vuelo),
   aportan, chocan con el tope y comprueban que todo se guarda. `npm test`. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Wallet } = require('ethers');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'launchpad-'));
process.env.SEED_DEMO = '';
process.env.RATE_LIMIT = '100000';
const { start, store, CATALOG } = require('./server');

let base, server;
const j = async (p, opts = {}) => {
  const r = await fetch(base + p, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  return { status: r.status, data: await r.json() };
};
async function signIn(wallet) {
  const { data: { message } } = await j('/api/auth/nonce', { method: 'POST', body: { address: wallet.address } });
  const signature = await wallet.signMessage(message);
  const { status, data } = await j('/api/auth/verify', { method: 'POST', body: { address: wallet.address, signature } });
  assert.equal(status, 200);
  return { authorization: 'Bearer ' + data.token };
}

test.before(async () => { server = await start(0); base = `http://127.0.0.1:${server.address().port}`; });

test('la mesa llega con fases calculadas y sin cifras inventadas', async () => {
  const { status, data } = await j('/api/launches');
  assert.equal(status, 200);
  assert.equal(data.launches.length, CATALOG.length);
  const phases = new Set(data.launches.map((l) => l.phase));
  assert.ok(phases.has('live') && phases.has('soon') && phases.has('done'));
  assert.ok(data.launches.every((l) => l.raised === 0 && l.backers === 0 && l.demo === false));
  assert.ok(data.launches.every((l) => l.pair === `${l.tick}/${l.parent}`));
});

test('una firma de otra cartera no entra', async () => {
  const a = Wallet.createRandom(), b = Wallet.createRandom();
  const { data: { message } } = await j('/api/auth/nonce', { method: 'POST', body: { address: a.address } });
  const { status } = await j('/api/auth/verify', { method: 'POST', body: { address: a.address, signature: await b.signMessage(message) } });
  assert.equal(status, 401);
});

test('aportar exige sesión, respeta la fase y el tope por cartera, y se guarda', async () => {
  const live = (await j('/api/launches')).data.launches.find((l) => l.phase === 'live');
  const soon = (await j('/api/launches')).data.launches.find((l) => l.phase === 'soon');
  assert.equal((await j(`/api/launches/${live.id}/contribute`, { method: 'POST', body: { amount: 10 } })).status, 401);

  const headers = await signIn(Wallet.createRandom());
  assert.equal((await j(`/api/launches/${soon.id}/contribute`, { method: 'POST', headers, body: { amount: 10 } })).status, 409);
  assert.equal((await j(`/api/launches/${live.id}/contribute`, { method: 'POST', headers, body: { amount: -5 } })).status, 400);

  const ok = await j(`/api/launches/${live.id}/contribute`, { method: 'POST', headers, body: { amount: 120.5 } });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.launch.raised, 120.5);
  assert.equal(ok.data.launch.backers, 1);

  const over = await j(`/api/launches/${live.id}/contribute`, { method: 'POST', headers, body: { amount: live.walletCap } });
  assert.equal(over.status, 409);
  assert.match(over.data.error, /wallet cap/);

  const me = await j('/api/me', { headers });
  assert.equal(me.data.contributions.length, 1);

  await new Promise((r) => setTimeout(r, 50));
  const onDisk = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, 'launchpad.json'), 'utf8'));
  assert.equal(onDisk.contributions.length, 1);
  assert.equal(onDisk.contributions[0].amount, 120.5);
});

test('llegar al objetivo cierra la ventana', async () => {
  const live = (await j('/api/launches')).data.launches.filter((l) => l.phase === 'live').at(-1);
  const st = store.launches[live.id];
  let raised = live.raised;
  while (raised < live.goal) {
    const headers = await signIn(Wallet.createRandom());
    const amount = Math.min(live.walletCap, live.goal - raised);
    const r = await j(`/api/launches/${live.id}/contribute`, { method: 'POST', headers, body: { amount } });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    raised += amount;
  }
  assert.ok(st.closedAt);
  const after = (await j(`/api/launches/${live.id}`)).data;
  assert.equal(after.phase, 'done');
  assert.equal(after.outcome, 'ok');
  assert.equal(after.closedEarly, true);
});

test('los ficheros del servidor no se sirven', async () => {
  for (const p of ['/server.js', '/launches.js', '/package.json', '/data/launchpad.json', '/../server.js']) {
    assert.equal((await fetch(base + p)).status, 404, p);
  }
  assert.equal((await fetch(base + '/')).status, 200);
});

test.after(() => { server.closeAllConnections(); server.close(); });
