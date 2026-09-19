/* Standalone mode: the game with no server behind it.

   The app talks to its server through fetch and an EventSource. This file
   stands in for both, so the same app runs as one HTML file with nothing
   behind it: a round machine on the five minute clock, a field of bots, a
   pot that climbs a cent at a time, and a demo wallet. It answers the same
   routes with the same shapes, so app.js does not know the difference.

   What it cannot do is be fair between strangers: there is no committed
   secret because there is no server to hold one, and nothing here reaches a
   chain. It says so on the page. Loaded before app.js, only in the built
   preview. */

(function () {
  'use strict';

  const ROUND_MS = 300000, LOBBY_MS = 225000, LOCK_MS = 5000, RESULT_MS = 25000, MAX = 250;
  const MEGA_EVERY = 1800000;
  const HEX = '0123456789abcdef';
  const rndAddr = () => { let s = '0x'; for (let i = 0; i < 40; i++) s += HEX[(Math.random() * 16) | 0]; return s; };
  const NAMES = ['DEGEN', 'APE', 'WHALE', 'CHAD', 'PAPERHANDS', 'DIAMOND', 'GM', 'WAGMI', 'MOON', 'BAGS', 'ALPHA', 'REKT', 'FOMO', 'HODL', 'SER', 'FREN'];
  const listeners = new Set();
  const emit = (event, data) => { for (const fn of listeners) fn(event, data); };
  const sha = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0').repeat(8); };

  const store = { counter: 0, rounds: [], chat: [] };
  let round = null, timer = null, potTimer = null, botTimer = null;
  const now = () => Date.now();

  function colorOf(a) { a = a.toLowerCase(); let h = 2166136261; for (let i = 0; i < a.length; i++) { h ^= a.charCodeAt(i); h = Math.imul(h, 16777619); } h >>>= 0; return 'hsl(' + (h % 360) + ' ' + (62 + (h >>> 9) % 26) + '% ' + (52 + (h >>> 17) % 14) + '%)'; }
  const faceOf = (a) => RENDER.FACES[Math.abs([...a].reduce((h, c) => Math.imul(h, 33) ^ c.charCodeAt(0), 5381)) % RENDER.FACES.length];
  const matOf = (a) => SKINS.materialOf(a);

  function open(startAt) {
    while (now() > startAt + LOBBY_MS - 20000) startAt += ROUND_MS;
    const secret = rndAddr() + rndAddr();
    round = {
      id: 'R' + startAt, number: ++store.counter, startAt, lockAt: startAt + LOBBY_MS, raceAt: startAt + LOBBY_MS + LOCK_MS, endAt: startAt + ROUND_MS,
      phase: 'lobby', mega: startAt % MEGA_EVERY === 0, secret, commit: sha(secret), seed: null, players: [], order: null, winner: null, seconds: 0,
      pot: 0, potDemo: true, potTarget: 0, max: MAX
    };
    round.potTarget = round.mega ? 25 : 3 + Math.random() * 4;
    emit('phase', pub());
    /* bots drift in over the queue */
    clearInterval(botTimer);
    let bots = 14 + Math.floor(Math.random() * 20);
    botTimer = setInterval(() => {
      if (!round || round.phase !== 'lobby' || bots-- <= 0) return;
      const a = rndAddr();
      join(a, { name: Math.random() < 0.4 ? NAMES[(Math.random() * NAMES.length) | 0] + '_' + ((Math.random() * 90 + 10) | 0) : '' });
    }, 700 + Math.random() * 900);
    clearInterval(potTimer);
    potTimer = setInterval(() => {
      if (!round || round.phase !== 'lobby') return;
      const secs = Math.max(20, (round.lockAt - now()) / 1000 + 1);
      const step = ((round.potTarget - round.pot) / secs) * (0.6 + Math.random() * 0.8);
      round.pot = Math.min(round.potTarget, Math.round((round.pot + step) * 100) / 100);
      emit('pot', { roundId: round.id, pot: round.pot, demo: true, mega: round.mega, final: false });
    }, 1000);
    at(round.lockAt, lock);
  }
  function at(when, fn) { clearTimeout(timer); timer = setTimeout(fn, Math.max(0, when - now())); }
  function lock() {
    if (!round || round.phase !== 'lobby') return;
    round.phase = 'locked';
    round.seed = parseInt(sha(round.secret + '|' + round.players.map((p) => p.address).join(',')).slice(0, 8), 16) >>> 0;
    emit('phase', pub());
    at(round.raceAt, race);
  }
  function race() {
    if (!round || round.phase !== 'locked') return;
    if (!round.players.length) { round.phase = 'result'; round.order = []; emit('phase', pub()); at(round.endAt, close); return; }
    round.phase = 'racing';
    const out = RACE.runToEnd(round.seed, round.players.map((p) => ({ id: p.address })));
    round.order = out.order; round.seconds = out.seconds; round.winner = out.order[0].id;
    emit('start', { roundId: round.id, seed: round.seed, secret: round.secret, commit: round.commit, startAt: round.raceAt, players: round.players.map(pubPlayer) });
    setTimeout(result, Math.min(44500, Math.ceil(out.seconds * 1000) + 1400));
  }
  function result() {
    if (!round || round.phase !== 'racing') return;
    round.phase = 'result';
    store.rounds.unshift({ id: round.id, number: round.number, startAt: round.startAt, winner: round.winner, pot: round.pot, players: round.players.map((p) => p.address), order: round.order.slice(0, 20), seconds: round.seconds, seed: round.seed, commit: round.commit, secret: round.secret, mega: round.mega, paid: false, tx: '' });
    emit('result', { roundId: round.id, number: round.number, winner: round.winner, pot: round.pot, seconds: round.seconds, order: round.order.slice(0, 10), secret: round.secret, commit: round.commit, seed: round.seed, mega: round.mega });
    at(round.endAt, close);
  }
  function close() { open(Math.floor(now() / ROUND_MS) * ROUND_MS); }

  function join(address, skin) {
    if (!round) return { error: 'starting' };
    if (round.phase !== 'lobby') return { error: 'closed' };
    if (round.players.some((p) => p.address === address)) return { ok: true, already: true };
    if (round.players.length >= MAX) return { error: 'full', queued: 1 };
    const p = { address, joinedAt: now(), color: (skin && /^#[0-9a-f]{6}$/i.test(skin.color)) ? skin.color : colorOf(address), face: RENDER.FACES.includes(skin && skin.face) ? skin.face : faceOf(address), material: SKINS.MATERIALS.includes(skin && skin.material) ? skin.material : matOf(address), name: String((skin && skin.name) || '').replace(/[^\w .\-]/g, '').slice(0, 16) };
    round.players.push(p);
    emit('join', { roundId: round.id, player: pubPlayer(p), count: round.players.length });
    return { ok: true, count: round.players.length };
  }
  const pubPlayer = (p) => ({ address: p.address, color: p.color, face: p.face, material: p.material, name: p.name });
  function pub() {
    return { id: round.id, number: round.number, phase: round.phase, mega: round.mega, startAt: round.startAt, lockAt: round.lockAt, raceAt: round.raceAt, endAt: round.endAt, commit: round.commit,
      seed: round.phase === 'lobby' ? null : round.seed, secret: round.phase === 'result' || round.phase === 'racing' ? round.secret : null,
      pot: round.pot, potDemo: true, players: round.players.map(pubPlayer), count: round.players.length, max: MAX, winner: round.phase === 'result' ? round.winner : null, order: round.phase === 'result' && round.order ? round.order.slice(0, 10) : null, seconds: round.seconds };
  }
  function schedule() {
    const out = [];
    for (let i = 0; i < 4; i++) { const s = round.startAt + i * ROUND_MS; out.push({ id: 'R' + s, number: round.number + i, startAt: s, lockAt: s + LOBBY_MS, raceAt: s + LOBBY_MS + LOCK_MS, mega: s % MEGA_EVERY === 0, open: i === 0 && round.phase === 'lobby', count: i === 0 ? round.players.length : 0, max: MAX }); }
    return out;
  }
  const config = { coin: 'MARBLE ROYALE', ticker: '', mint: '', chain: 'Robinhood Chain', explorer: 'https://etherscan.io', currency: 'USD', potPct: 100, megaPct: 100, demoMode: true, entry: 'FREE', links: { buy: '', x: '', telegram: '' }, payoutNote: '', standalone: true, faces: RENDER.FACES };
  const snapshot = () => ({ now: now(), config, round: pub(), schedule: schedule(), recent: store.rounds.slice(0, 12), top: [], chat: store.chat.slice(-40), watching: 1 + (round ? round.players.length : 0) });

  /* ---- the shims -------------------------------------------------------- */

  const tokens = new Map();
  const realFetch = window.fetch.bind(window);
  window.fetch = async function (url, opts) {
    const u = String(url);
    if (!u.startsWith('/api/')) return realFetch(url, opts);
    const body = opts && opts.body ? JSON.parse(opts.body) : {};
    const reply = (code, data) => new Response(JSON.stringify(data), { status: code, headers: { 'content-type': 'application/json' } });
    const path = u.split('?')[0];
    const q = new URLSearchParams(u.split('?')[1] || '');
    if (path === '/api/state') return reply(200, snapshot());
    if (path === '/api/schedule') return reply(200, { now: now(), schedule: schedule() });
    if (path === '/api/history') return reply(200, { rounds: store.rounds.slice(0, 50), top: [] });
    if (path === '/api/round') { const r = store.rounds.find((x) => x.id === q.get('id')); return r ? reply(200, { round: Object.assign({}, r, { field: r.players }) }) : reply(404, { error: 'unknown round' }); }
    if (path === '/api/nonce') return reply(200, { nonce: 'standalone', message: 'MARBLE ROYALE standalone: no server, nothing to sign.' });
    if (path === '/api/auth') {
      /* a real wallet's address is taken at its word here: there is no server
         to check a signature, and nothing here is worth forging */
      const address = body.demo ? rndAddr() : body.address;
      const token = 'sa.' + address;
      tokens.set(token, address);
      return reply(200, { token, address, demo: !!body.demo, stats: { wins: 0, races: 0 } });
    }
    const who = tokens.get(body.token);
    if (path === '/api/join') { if (!who) return reply(401, { error: 'sign in again' }); const r = join(who, body); return reply(r.error ? 409 : 200, r); }
    if (path === '/api/chat') { if (!who) return reply(401, { error: 'sign in to chat' }); const m = { from: who, text: String(body.text || '').slice(0, 140), at: now() }; store.chat.push(m); emit('chat', m); return reply(200, { ok: true }); }
    if (path === '/api/cheer') { if (!who) return reply(401, { error: 'sign in to cheer' }); emit('cheer', { from: who, target: body.target, at: now() }); return reply(200, { ok: true }); }
    return reply(404, { error: 'no such route' });
  };

  /* A page's EventSource that never leaves the page. */
  window.EventSource = function FakeEventSource() {
    const handlers = new Map();
    const es = { addEventListener: (ev, fn) => { if (!handlers.has(ev)) handlers.set(ev, []); handlers.get(ev).push(fn); }, close() { listeners.delete(relay); clearInterval(tick); } };
    const send = (ev, data) => { for (const fn of handlers.get(ev) || []) fn({ data: JSON.stringify(data) }); };
    const relay = (ev, data) => send(ev, data);
    listeners.add(relay);
    setTimeout(() => send('state', snapshot()), 0);
    const tick = setInterval(() => send('tick', { now: now(), phase: round && round.phase, count: round ? round.players.length : 0, id: round && round.id, watching: 1 + (round ? round.players.length : 0) }), 1000);
    return es;
  };

  /* The real wallet still signs nothing here: WALLET.signMessage is skipped
     by answering the nonce route with a note, and app.js sends whatever the
     wallet returns; a wallet asked to sign that note is fine too. */
  open(Math.floor(now() / ROUND_MS) * ROUND_MS);
  window.STANDALONE = { get round() { return round; }, join, raceNow() { if (round && round.phase === 'lobby') { round.lockAt = now(); lock(); round.raceAt = now() + 3200; at(round.raceAt, race); emit('phase', pub()); } } };
})();
