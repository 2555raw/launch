/* Standalone mode: the game with no server behind it.

   The app talks to its server through fetch and an EventSource. This file
   stands in for both, so the same app runs as one HTML file with nothing
   behind it: a round machine on the ten minute clock, a field of bots, a
   pot that climbs a cent at a time, and a demo wallet. It answers the same
   routes with the same shapes, so app.js does not know the difference.

   What it cannot do is be fair between strangers: there is no committed
   secret because there is no server to hold one, and nothing here reaches a
   chain. It says so on the page. Loaded before app.js, only in the built
   preview. */

(function () {
  'use strict';

  const ROUND_MS = 360000, LOBBY_MS = 220000, LOCK_MS = 5000, RESULT_MS = 60000, MAX = 30, MAX_HIGH = 50, GROW_AT = 24;
  const MEGA_EVERY = 2400000;
  const HEX = '0123456789abcdef';
  const rndAddr = () => { let s = '0x'; for (let i = 0; i < 40; i++) s += HEX[(Math.random() * 16) | 0]; return s; };
  const NAMES = ['DEGEN', 'APE', 'WHALE', 'CHAD', 'PAPERHANDS', 'DIAMOND', 'GM', 'WAGMI', 'MOON', 'BAGS', 'ALPHA', 'REKT', 'FOMO', 'HODL', 'SER', 'FREN'];
  const listeners = new Set();
  const emit = (event, data) => { for (const fn of listeners) fn(event, data); };
  /* Real SHA-256, so the page's own verifier passes on a standalone race
     the same way it does on a served one. */
  const sha = async (s) => { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join(''); };

  const store = { counter: 0, rounds: [], chat: [] };
  let round = null, timer = null, potTimer = null, botTimer = null, pollTimer = null, voteTimer = null;
  let nextMode = null;
  const now = () => Date.now();

  function colorOf(a) { a = a.toLowerCase(); let h = 2166136261; for (let i = 0; i < a.length; i++) { h ^= a.charCodeAt(i); h = Math.imul(h, 16777619); } h >>>= 0; return 'hsl(' + (h % 360) + ' ' + (62 + (h >>> 9) % 26) + '% ' + (52 + (h >>> 17) % 14) + '%)'; }
  const faceOf = (a) => RENDER.FACES[Math.abs([...a].reduce((h, c) => Math.imul(h, 33) ^ c.charCodeAt(0), 5381)) % RENDER.FACES.length];
  const matOf = (a) => SKINS.materialOf(a);

  function open(startAt) {
    while (now() > startAt + LOBBY_MS - 20000) startAt += ROUND_MS;
    const secret = rndAddr() + rndAddr();
    round = {
      id: 'R' + startAt, number: ++store.counter, startAt, lockAt: startAt + LOBBY_MS, raceAt: startAt + LOBBY_MS + LOCK_MS, endAt: startAt + ROUND_MS,
      phase: 'lobby', mega: Math.floor(startAt / MEGA_EVERY) !== Math.floor((startAt - ROUND_MS) / MEGA_EVERY), secret, commit: '', seed: null, players: [], order: null, winner: null, seconds: 0,
      pot: 0, potDemo: true, potTarget: 0, max: MAX,
      mode: RACE.MODE_IDS.includes(nextMode) ? nextMode : 'classic', modeBy: RACE.MODE_IDS.includes(nextMode) ? 'vote' : 'default', poll: null
    };
    round.potTarget = round.mega ? 25 : 4 + Math.random() * 3.5;
    const me = round;
    sha(secret).then((h) => { if (round === me) { me.commit = h; emit('phase', pub()); } });
    emit('phase', pub());
    /* bots drift in over the queue */
    clearInterval(botTimer);
    let bots = 14 + Math.floor(Math.random() * 28);
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
      emit('pot', { roundId: round.id, pot: round.pot, potFull: round.potTarget, demo: true, mega: round.mega, final: false });
    }, 1000);
    at(round.lockAt, lock);
  }
  function at(when, fn) { clearTimeout(timer); timer = setTimeout(fn, Math.max(0, when - now())); }
  function lock() {
    if (!round || round.phase !== 'lobby') return;
    round.phase = 'locked';
    const me = round;
    sha(me.secret + '|' + me.players.map((p) => p.address).join(',')).then((h) => {
      if (round !== me) return;
      me.seed = parseInt(h.slice(0, 8), 16) >>> 0;
      emit('phase', pub());
    });
    at(round.raceAt, race);
  }
  function race() {
    if (!round || round.phase !== 'locked') return;
    if (round.seed === null) { setTimeout(race, 20); return; }
    if (!round.players.length) { round.phase = 'result'; round.order = []; emit('phase', pub()); at(round.endAt, close); return; }
    round.phase = 'racing';
    const out = RACE.runToEnd(round.seed, round.players.map((p) => ({ id: p.address })), round.mode);
    round.order = out.order; round.seconds = out.seconds; round.winner = out.order[0].id;
    emit('start', { roundId: round.id, seed: round.seed, secret: round.secret, commit: round.commit, startAt: round.raceAt, mode: round.mode, players: round.players.map(pubPlayer) });
    setTimeout(result, Math.min(74500, Math.ceil(out.seconds * 1000) + 1400));
  }
  function result() {
    if (!round || round.phase !== 'racing') return;
    round.phase = 'result';
    store.rounds.unshift({ id: round.id, number: round.number, startAt: round.startAt, winner: round.winner, pot: round.pot, players: round.players.map((p) => p.address), order: round.order.slice(0, 20), seconds: round.seconds, seed: round.seed, commit: round.commit, secret: round.secret, mega: round.mega, mode: round.mode, paid: false, tx: '' });
    openPoll();
    emit('result', { roundId: round.id, number: round.number, winner: round.winner, pot: round.pot, seconds: round.seconds, order: round.order.slice(0, 10), secret: round.secret, commit: round.commit, seed: round.seed, mega: round.mega, mode: round.mode, poll: pubPoll() });
    at(round.endAt, close);
  }
  function close() { closePoll(); open(Math.floor(now() / ROUND_MS) * ROUND_MS); }

  /* The poll: two tracks, never the one just raced. The bots vote too, one
     every second or so, so the bars move. */
  function openPoll() {
    const pool = RACE.MODE_IDS.filter((m) => m !== round.mode).sort(() => Math.random() - 0.5);
    round.poll = { a: pool[0], b: pool[1], votes: { [pool[0]]: 0, [pool[1]]: 0 }, voters: new Map(), closesAt: round.endAt - 2000, winner: null };
    clearTimeout(pollTimer); clearInterval(voteTimer);
    pollTimer = setTimeout(closePoll, Math.max(0, round.poll.closesAt - now()));
    const lean = Math.random() < 0.5 ? round.poll.a : round.poll.b;
    let left = Math.min(round.players.length, 6 + Math.floor(Math.random() * 12));
    voteTimer = setInterval(() => {
      if (!round.poll || round.poll.winner || left-- <= 0) return;
      const bot = round.players[Math.floor(Math.random() * round.players.length)];
      if (bot) vote(bot.address, Math.random() < 0.65 ? lean : (lean === round.poll.a ? round.poll.b : round.poll.a));
    }, 900 + Math.random() * 900);
  }
  function closePoll() {
    const p = round && round.poll;
    if (!p || p.winner) return;
    const va = p.votes[p.a], vb = p.votes[p.b];
    p.winner = va > vb ? p.a : vb > va ? p.b : (Math.random() < 0.5 ? p.a : p.b);
    nextMode = p.winner;
    emit('poll', pubPoll());
  }
  function vote(address, choice) {
    const p = round && round.poll;
    if (!p || round.phase !== 'result') return { error: 'no poll is open' };
    if (p.winner || now() >= p.closesAt) return { error: 'the poll has closed' };
    if (choice !== p.a && choice !== p.b) return { error: 'that track is not on the poll' };
    const before = p.voters.get(address);
    if (before === choice) return { ok: true, poll: pubPoll() };
    if (before) p.votes[before]--;
    p.voters.set(address, choice); p.votes[choice]++;
    emit('poll', pubPoll());
    return { ok: true, poll: pubPoll() };
  }
  const pubPoll = () => { const p = round && round.poll; return p ? { roundId: round.id, a: p.a, b: p.b, votes: { [p.a]: p.votes[p.a], [p.b]: p.votes[p.b] }, total: p.votes[p.a] + p.votes[p.b], closesAt: p.closesAt, winner: p.winner } : null; };

  function join(address, skin) {
    if (!round) return { error: 'starting' };
    if (round.phase !== 'lobby') return { error: 'closed' };
    if (round.players.some((p) => p.address === address)) return { ok: true, already: true };
    if (round.players.length >= round.max) return { error: 'full', queued: 1 };
    const p = { address, joinedAt: now(), color: (skin && /^#[0-9a-f]{6}$/i.test(skin.color)) ? skin.color : colorOf(address), face: RENDER.FACES.includes(skin && skin.face) ? skin.face : faceOf(address), material: SKINS.MATERIALS.includes(skin && skin.material) ? skin.material : matOf(address), name: String((skin && skin.name) || '').replace(/[^\w .\-]/g, '').slice(0, 16) };
    round.players.push(p);
    if (round.max < MAX_HIGH && round.players.length >= GROW_AT) { round.max = MAX_HIGH; emit('cap', { roundId: round.id, max: round.max, count: round.players.length }); }
    emit('join', { roundId: round.id, player: pubPlayer(p), count: round.players.length, max: round.max });
    return { ok: true, count: round.players.length, max: round.max };
  }
  const pubPlayer = (p) => ({ address: p.address, color: p.color, face: p.face, material: p.material, name: p.name });
  function pub() {
    return { id: round.id, number: round.number, phase: round.phase, mega: round.mega, mode: round.mode, modeBy: round.modeBy, poll: pubPoll(), startAt: round.startAt, lockAt: round.lockAt, raceAt: round.raceAt, endAt: round.endAt, commit: round.commit,
      seed: round.phase === 'lobby' ? null : round.seed, secret: round.phase === 'result' || round.phase === 'racing' ? round.secret : null,
      pot: round.pot, potFull: round.potTarget, potDemo: true, players: round.players.map(pubPlayer), count: round.players.length, max: round.max, winner: round.phase === 'result' ? round.winner : null, order: round.phase === 'result' && round.order ? round.order.slice(0, 10) : null, seconds: round.seconds };
  }
  function schedule() {
    const out = [];
    for (let i = 0; i < 4; i++) { const s = round.startAt + i * ROUND_MS; const w = round.poll && round.poll.winner; out.push({ id: 'R' + s, number: round.number + i, startAt: s, lockAt: s + LOBBY_MS, raceAt: s + LOBBY_MS + LOCK_MS, mega: s % MEGA_EVERY === 0, open: i === 0 && round.phase === 'lobby', count: i === 0 ? round.players.length : 0, max: i === 0 ? round.max : MAX, mode: i === 0 ? round.mode : i === 1 && w ? w : null, modeBy: i === 0 ? round.modeBy : i === 1 && w ? 'vote' : 'poll' }); }
    return out;
  }
  const config = { coin: 'MARBLERUSH', ticker: '', mint: '', chain: 'Robinhood Chain', explorer: 'https://robinhoodchain.blockscout.com', currency: 'USD', potPct: 100, megaPct: 100, demoMode: true, entry: 'FREE', links: { buy: '', x: '', telegram: '' }, payoutNote: '', standalone: true, faces: RENDER.FACES,
    maxPlayers: MAX, maxPlayersHigh: MAX_HIGH, modes: RACE.MODE_IDS.map((id) => ({ id, name: RACE.MODES[id].name, blurb: RACE.MODES[id].blurb, gravity: RACE.MODES[id].gravity, bounce: RACE.MODES[id].bounce })) };
  const snapshot = () => ({ now: now(), config, round: pub(), schedule: schedule(), recent: store.rounds.slice(0, 12), top: [], rewards: [], paidTotal: 0, launches: store.launches || [], chat: store.chat.slice(-40), watching: 1 + (round ? round.players.length : 0) });

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
    if (path === '/api/history') return reply(200, { rounds: store.rounds.slice(0, 50), top: [], rewards: [], paidTotal: 0 });
    if (path === '/api/round') { const r = store.rounds.find((x) => x.id === q.get('id')); return r ? reply(200, { round: Object.assign({}, r, { field: r.players }) }) : reply(404, { error: 'unknown round' }); }
    if (path === '/api/nonce') return reply(200, { nonce: 'standalone', message: 'MARBLERUSH standalone: no server, nothing to sign.' });
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
    if (path === '/api/skin') {
      if (!who) return reply(401, { error: 'sign in again' });
      if (!round || round.phase !== 'lobby') return reply(409, { error: 'the queue is closed; the look is fixed for this race' });
      const pl = round.players.find((x) => x.address === who);
      if (!pl) return reply(409, { error: 'not in this race' });
      if (/^#[0-9a-f]{6}$/i.test(body.color || '')) pl.color = body.color;
      if (RENDER.FACES.includes(body.face)) pl.face = body.face;
      if (SKINS.MATERIALS.includes(body.material)) pl.material = body.material;
      pl.name = String(body.name || '').replace(/[^\w .\-]/g, '').slice(0, 16);
      emit('skin', { roundId: round.id, player: pubPlayer(pl) });
      return reply(200, { ok: true, player: pubPlayer(pl) });
    }
    if (path === '/api/launch') { if (!who) return reply(401, { error: 'sign in again' }); if (!/^0x[0-9a-fA-F]{40}$/.test(String(body.tokenAddress || ''))) return reply(400, { error: 'no token address' }); const l = { id: 'T' + now().toString(36), at: now(), token: body.tokenAddress, curve: body.curve || '', deployer: who, hash: body.hash || '', name: String(body.name || 'Token').slice(0, 32), ticker: String(body.ticker || 'TOKEN').toUpperCase().slice(0, 10), desc: String(body.desc || '').slice(0, 200), image: String(body.image || ''), twitter: String(body.twitter || ''), telegram: String(body.telegram || ''), website: String(body.website || ''), color: body.color || '#ff7a1a', face: body.face || '', buyHash: body.buyHash || '', buyWei: body.buyWei || '' }; store.launches = [l].concat((store.launches || []).filter((x) => x.token !== l.token)).slice(0, 100); emit('launch', { launch: l, launches: store.launches.slice(0, 24) }); return reply(200, { ok: true, launch: l }); }
    if (path === '/api/launches') return reply(200, { launches: store.launches || [] });
    if (path === '/api/chat') { if (!who) return reply(401, { error: 'sign in to chat' }); const pl = round && round.players.find((x) => x.address === who); const m = { from: who, name: (pl && pl.name) || '', text: String(body.text || '').slice(0, 140), at: now() }; store.chat.push(m); emit('chat', m); return reply(200, { ok: true }); }
    if (path === '/api/vote') { if (!who) return reply(401, { error: 'sign in to vote' }); const r = vote(who, String(body.choice || '')); return reply(r.error ? 409 : 200, r); }
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
  window.STANDALONE = { get round() { return round; }, join, raceNow() { if (round && round.phase === 'lobby') { round.lockAt = now(); lock(); round.raceAt = now() + 3200; round.endAt = round.raceAt + 135000; at(round.raceAt, race); emit('phase', pub()); } } };
})();
