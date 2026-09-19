/* MARBLERUSH - the server.

   One process: it serves the page, keeps the five minute clock, plays each race
   out the moment the field closes, and pushes what happens to every open browser
   over a single event stream. No framework and no database, because it needs
   neither: the whole state of the game is one round in memory and a JSON file of
   results on disk.

   What it never does is hold a key or move money. It reads a balance to say what
   a round is worth and it shows you the winner's address; paying that address is
   yours to do, from your own wallet, with your own hands. */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const store = require('./lib/store');
const launches = require('./lib/launches');
const chain = require('./lib/chain');
const RACE = require('./public/shared/race.js');
const { Rounds, ROUND_MS, LOBBY_MS, MAX_PLAYERS, MAX_PLAYERS_HIGH, FEE_WALLET, POT_PCT, MEGA_PCT, MEGA_EVERY_MS, FACES } = require('./lib/round');

const PORT = Number(process.env.PORT) || 8080;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_MINT = process.env.TOKEN_MINT || '';
/* Demo mode hands out demo wallets: a random address and a session, no
   signature, so the game can be tried with nothing installed. Everything a
   demo wallet does is marked demo; it never reaches a chain. Off unless asked. */
const DEMO_MODE = process.env.DEMO_MODE === '1';
const MIN_TOKENS = Math.max(0, Number(process.env.MIN_TOKENS) || 0);
const PUBLIC = path.join(__dirname, 'public');

const CONFIG = {
  coin: process.env.COIN_NAME || 'MARBLERUSH',
  ticker: process.env.COIN_TICKER || '',
  mint: TOKEN_MINT,
  minTokens: MIN_TOKENS,
  feeWallet: FEE_WALLET,
  chain: process.env.CHAIN_NAME || 'Robinhood Chain',
  explorer: process.env.EXPLORER || 'https://robinhoodchain.blockscout.com',
  currency: 'USD',
  potPct: POT_PCT,
  megaPct: MEGA_PCT,
  demoMode: DEMO_MODE,
  entry: process.env.ENTRY_LABEL || 'FREE',
  megaEveryMs: MEGA_EVERY_MS,
  faces: FACES,
  roundMs: ROUND_MS,
  lobbyMs: LOBBY_MS,
  maxPlayers: MAX_PLAYERS,
  maxPlayersHigh: MAX_PLAYERS_HIGH,
  modes: RACE.MODE_IDS.map((id) => ({ id, name: RACE.MODES[id].name, blurb: RACE.MODES[id].blurb, gravity: RACE.MODES[id].gravity, bounce: RACE.MODES[id].bounce })),
  links: {
    buy: process.env.LINK_BUY || '',
    x: process.env.LINK_X || '',
    telegram: process.env.LINK_TG || ''
  },
  payoutNote: process.env.PAYOUT_NOTE || ''
};

const rounds = new Rounds();
store.load();

/* ---- helpers ------------------------------------------------------------- */

const json = (res, code, body) => {
  const s = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(s);
};

function readBody(req, limit = 4096) {
  return new Promise((resolve) => {
    let data = '', over = false;
    req.on('data', (c) => {
      if (over) return;
      data += c;
      if (data.length > limit) { over = true; resolve(null); req.destroy(); }
    });
    req.on('end', () => { if (!over) { try { resolve(JSON.parse(data || '{}')); } catch { resolve(null); } } });
    req.on('error', () => resolve(null));
  });
}

const ipOf = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';

/* A bucket per caller per action: enough to keep a script from flooding the
   chat or hammering the RPC, and invisible to anyone playing normally. The
   limits are deliberately loose on the wallet routes, because a whole Telegram
   group coming through one mobile carrier looks like one address from here.
   What actually stops a flood of fake entries is the signature, and MIN_TOKENS
   if you set it. */
const buckets = new Map();
function allow(key, perMinute, burst) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) { b = { tokens: burst, at: now }; buckets.set(key, b); }
  b.tokens = Math.min(burst, b.tokens + ((now - b.at) / 60000) * perMinute);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now - b.at > 600000) buckets.delete(k);
}, 300000).unref();

/* ---- who you are --------------------------------------------------------- */

/* A wallet proves itself once by signing a sentence, and gets a token that
   lasts a day. Without this anyone could type someone else's address and be
   paid for their marble. */

const nonces = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [n, v] of nonces) if (v.exp < now) nonces.delete(n);
}, 60000).unref();

const TOKEN_TTL = 24 * 3600 * 1000;

function mintToken(address) {
  const exp = Date.now() + TOKEN_TTL;
  const body = address + '.' + exp;
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url').slice(0, 32);
  return body + '.' + mac;
}

function readToken(token) {
  if (typeof token !== 'string' || token.length > 200) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [address, exp, mac] = parts;
  const want = crypto.createHmac('sha256', SESSION_SECRET).update(address + '.' + exp).digest('base64url').slice(0, 32);
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  if (Number(exp) < Date.now()) return null;
  return address;
}

/* The token gate, when there is one. Answers are cached for a minute so a room
   full of people does not turn into a room full of RPC calls. */
const holdings = new Map();
async function holdsEnough(address) {
  if (!MIN_TOKENS || !TOKEN_MINT) return { ok: true };
  const hit = holdings.get(address);
  if (hit && Date.now() - hit.at < 60000) return { ok: hit.amount >= MIN_TOKENS, amount: hit.amount };
  const amount = await chain.tokenBalance(address, TOKEN_MINT);
  holdings.set(address, { amount, at: Date.now() });
  return { ok: amount >= MIN_TOKENS, amount };
}

/* ---- the event stream ---------------------------------------------------- */

const clients = new Set();
const chatLog = [];

function send(res, event, data) {
  try { res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n'); } catch { /* gone */ }
}
function broadcast(event, data) {
  for (const res of clients) send(res, event, data);
}

for (const ev of ['phase', 'join', 'start', 'result', 'pot', 'poll', 'cap', 'skin']) {
  rounds.on(ev, (data) => broadcast(ev, data));
}

setInterval(() => {
  const r = rounds.publicRound();
  broadcast('tick', { now: Date.now(), phase: r && r.phase, count: r ? r.count : 0, id: r && r.id, watching: clients.size });
}, 1000).unref();

/* The fee wallet is read on a slow loop during the lobby, so the pot people see
   climbs while they wait. */
setInterval(() => { rounds.pollPot().catch(() => {}); }, 30000).unref();

/* The live config: what the environment set, with anything the creator has
   since saved from the console on top. */
function config() {
  const st = store.settings();
  return Object.assign({}, CONFIG, {
    mint: st.mint || CONFIG.mint,
    ticker: st.ticker || CONFIG.ticker,
    links: Object.assign({}, CONFIG.links, {
      buy: st.buy || CONFIG.links.buy,
      x: st.x || CONFIG.links.x,
      telegram: st.telegram || CONFIG.links.telegram
    })
  });
}

function snapshot() {
  return {
    now: Date.now(),
    config: config(),
    round: rounds.publicRound(),
    schedule: rounds.schedule(4),
    recent: store.recent(12).map(publicResult),
    top: store.top(10),
    rewards: store.paid(10).map(publicResult),
    paidTotal: store.paidTotal(),
    launches: store.launches(24),
    chat: chatLog.slice(-40),
    watching: clients.size
  };
}

const publicResult = (r) => ({
  id: r.id, number: r.number, startAt: r.startAt, winner: r.winner, pot: r.pot, gross: r.gross, mega: !!r.mega, mode: r.mode || 'classic', paidAt: r.paidAt || null,
  podium: (r.order || []).slice(0, 3),
  players: (r.players || []).length, seconds: r.seconds,
  paid: !!r.paid, tx: r.tx || '', seed: r.seed, commit: r.commit, secret: r.secret
});

/* ---- static files -------------------------------------------------------- */

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

function serveFile(res, rel) {
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) { res.writeHead(403).end('no'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
      'cache-control': /\.(html)$/.test(file) ? 'no-cache' : 'public, max-age=300'
    });
    res.end(buf);
  });
}

/* ---- routes -------------------------------------------------------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const ip = ipOf(req);

  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }

  /* --- stream --- */
  if (p === '/api/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no'
    });
    res.write('retry: 3000\n\n');
    clients.add(res);
    send(res, 'state', snapshot());
    const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch {} }, 20000);
    req.on('close', () => { clearInterval(ka); clients.delete(res); });
    return;
  }

  if (p === '/api/state') return json(res, 200, snapshot());
  if (p === '/api/schedule') return json(res, 200, { now: Date.now(), schedule: rounds.schedule(4) });

  if (p === '/api/history') {
    const n = Math.min(200, Math.max(1, Number(url.searchParams.get('n')) || 50));
    return json(res, 200, { rounds: store.recent(n).map(publicResult), top: store.top(25), rewards: store.paid(10).map(publicResult), paidTotal: store.paidTotal() });
  }

  if (p === '/api/round') {
    const r = store.findRound(url.searchParams.get('id') || '');
    if (!r) return json(res, 404, { error: 'unknown round' });
    return json(res, 200, { round: { ...publicResult(r), order: r.order, field: r.players } });
  }

  /* --- signing in --- */
  if (p === '/api/nonce') {
    const address = chain.normalize((url.searchParams.get('address') || '').trim());
    if (!address) return json(res, 400, { error: 'that is not an Ethereum address' });
    if (!allow('nonce:' + ip, 150, 50)) return json(res, 429, { error: 'slow down' });
    const nonce = crypto.randomBytes(12).toString('hex');
    nonces.set(nonce, { address, exp: Date.now() + 300000 });
    const message =
      'MARBLERUSH\n' +
      'Sign in to race your marble.\n' +
      'This proves the wallet is yours. It moves nothing and costs nothing.\n' +
      'wallet: ' + address + '\n' +
      'nonce: ' + nonce;
    return json(res, 200, { nonce, message });
  }

  if (p === '/api/auth' && req.method === 'POST') {
    if (!allow('auth:' + ip, 90, 40)) return json(res, 429, { error: 'slow down' });
    const body = await readBody(req);
    if (!body) return json(res, 400, { error: 'bad request' });
    if (body.demo) {
      if (!DEMO_MODE) return json(res, 403, { error: 'demo wallets are off on this server' });
      const address = chain.normalize('0x' + crypto.randomBytes(20).toString('hex'));
      return json(res, 200, { token: mintToken(address), address, demo: true, stats: store.statsFor(address) });
    }
    const address = chain.normalize(body.address);
    const { nonce, signature } = body;
    const entry = nonces.get(nonce);
    if (!entry || entry.address !== address) return json(res, 400, { error: 'that sign-in expired, try again' });
    nonces.delete(nonce);
    const message =
      'MARBLERUSH\n' +
      'Sign in to race your marble.\n' +
      'This proves the wallet is yours. It moves nothing and costs nothing.\n' +
      'wallet: ' + address + '\n' +
      'nonce: ' + nonce;
    if (!chain.verifySignature(address, message, signature)) return json(res, 401, { error: 'signature did not check out' });
    return json(res, 200, { token: mintToken(address), address, stats: store.statsFor(address) });
  }

  /* --- playing --- */
  if (p === '/api/join' && req.method === 'POST') {
    if (!allow('join:' + ip, 150, 50)) return json(res, 429, { error: 'slow down' });
    const body = await readBody(req);
    const address = body && readToken(body.token);
    if (!address) return json(res, 401, { error: 'sign in again' });

    const gate = await holdsEnough(address);
    if (!gate.ok) {
      return json(res, 403, {
        error: 'holders only',
        need: MIN_TOKENS, have: gate.amount || 0, mint: TOKEN_MINT
      });
    }
    const out = rounds.join(address, false, {
      color: body.color,
      face: body.face,
      material: body.material,
      name: body.name
    });
    if (out.error === 'closed') return json(res, 409, { error: 'this race is already closed - you are in the next one' });
    if (out.error === 'full') return json(res, 409, { error: 'this race is full', queued: out.queued });
    if (out.error === 'already') return json(res, 200, { ok: true, already: true, round: rounds.publicRound().id });
    if (out.error) return json(res, 503, { error: 'starting up, try again' });
    return json(res, 200, { ok: true, count: out.count, round: rounds.publicRound().id });
  }

  /* A marble's look and name can change while the queue is open; everyone
     sees the change at once. */
  if (p === '/api/skin' && req.method === 'POST') {
    const body = await readBody(req);
    const address = body && readToken(body.token);
    if (!address) return json(res, 401, { error: 'sign in again' });
    if (!allow('skin:' + address, 30, 8)) return json(res, 429, { error: 'easy there' });
    const out = rounds.restyle(address, { color: body.color, face: body.face, material: body.material, name: body.name });
    if (out.error) return json(res, 409, out);
    return json(res, 200, { ok: true, player: out.player });
  }

  /* A token someone launched through the Launch screen. The chain is the
     judge: the receipt of the reported hash has to carry the Pons factory's
     TokenLaunched log for this wallet. */
  if (p === '/api/launch' && req.method === 'POST') {
    const body = await readBody(req, 4096);
    const address = body && readToken(body.token);
    if (!address) return json(res, 401, { error: 'sign in again' });
    if (!allow('launch:' + address, 6, 6)) return json(res, 429, { error: 'easy there' });
    let chain;
    if (DEMO_MODE && body.demo) {
      chain = { token: String(body.tokenAddress || ''), curve: String(body.curve || ''), deployer: address };
      if (!/^0x[0-9a-fA-F]{40}$/.test(chain.token)) return json(res, 400, { error: 'no token address' });
    } else {
      chain = await launches.verify(body.hash, address);
      if (chain.error) return json(res, chain.retry ? 503 : 400, { error: chain.error });
    }
    const rec = store.addLaunch(launches.record(body, chain, address));
    broadcast('launch', { launch: rec, launches: store.launches(24) });
    return json(res, 200, { ok: true, launch: rec });
  }

  if (p === '/api/launches') return json(res, 200, { launches: store.launches(100) });

  if (p === '/api/chat' && req.method === 'POST') {
    const body = await readBody(req, 2048);
    const address = body && readToken(body.token);
    if (!address) return json(res, 401, { error: 'sign in to chat' });
    if (!allow('chat:' + address, 20, 4)) return json(res, 429, { error: 'easy on the chat' });
    const text = String(body.text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 140);
    if (!text) return json(res, 400, { error: 'say something' });
    const msg = { from: address, name: rounds.nameOf(address), text, at: Date.now() };
    chatLog.push(msg);
    if (chatLog.length > 200) chatLog.shift();
    broadcast('chat', msg);
    return json(res, 200, { ok: true });
  }

  /* One vote per wallet on the results screen: which of the two tracks the
     next race runs on. Changing your mind moves the vote. */
  if (p === '/api/vote' && req.method === 'POST') {
    const body = await readBody(req, 512);
    const address = body && readToken(body.token);
    if (!address) return json(res, 401, { error: 'sign in to vote' });
    if (!allow('vote:' + address, 30, 6)) return json(res, 429, { error: 'easy there' });
    const out = rounds.vote(address, String(body.choice || ''));
    if (out.error) return json(res, 409, out);
    return json(res, 200, out);
  }

  if (p === '/api/cheer' && req.method === 'POST') {
    const body = await readBody(req, 512);
    const address = body && readToken(body.token);
    if (!address) return json(res, 401, { error: 'sign in to cheer' });
    if (!allow('cheer:' + address, 60, 8)) return json(res, 429, { error: 'easy there' });
    const target = chain.normalize(body.target);
    if (!target) return json(res, 400, { error: 'no such marble' });
    /* Cheers are confetti. They are deliberately not part of the physics: if a
       cheer could move a marble, the race would be a popularity contest and the
       replay in your browser would stop matching the result. */
    broadcast('cheer', { from: address, target, at: Date.now() });
    return json(res, 200, { ok: true });
  }

  /* --- admin --- */
  if (p.startsWith('/api/admin/')) {
    const key = req.headers['x-admin-key'] || url.searchParams.get('key') || '';
    if (!ADMIN_KEY || key.length !== ADMIN_KEY.length ||
        !crypto.timingSafeEqual(Buffer.from(String(key)), Buffer.from(ADMIN_KEY))) {
      return json(res, 401, { error: 'no' });
    }
    if (p === '/api/admin/rounds') {
      const n = Math.min(500, Math.max(1, Number(url.searchParams.get('n')) || 100));
      return json(res, 200, { rounds: store.recent(n), unpaid: store.unpaid().length, feeWallet: FEE_WALLET });
    }
    if (p === '/api/admin/paid' && req.method === 'POST') {
      const body = await readBody(req);
      const r = store.markPaid(body && body.id, body && body.tx);
      if (!r) return json(res, 404, { error: 'unknown round' });
      /* every open page hears that the winner was paid */
      broadcast('paid', { round: publicResult(r), rewards: store.paid(10).map(publicResult), paidTotal: store.paidTotal() });
      return json(res, 200, { ok: true, round: r });
    }
    /* The token's contract address, pasted by the creator once the token
       exists. Every open page hears it at once; nothing here is on-chain. */
    if (p === '/api/admin/token' && req.method === 'POST') {
      const body = await readBody(req, 2048);
      const mint = String((body && body.mint) || '').trim();
      if (mint && !/^0x[0-9a-fA-F]{40}$/.test(mint)) return json(res, 400, { error: 'that is not a contract address on this chain' });
      const link = (v) => { const u = String(v || '').trim(); return !u || /^https?:\/\//i.test(u) ? u : 'https://' + u; };
      const saved = store.setSettings({
        mint,
        ticker: String((body && body.ticker) || '').trim().toUpperCase().replace(/[^A-Z0-9$]/g, '').slice(0, 12),
        buy: link(body && body.buy), x: link(body && body.x), telegram: link(body && body.telegram)
      });
      broadcast('config', config());
      return json(res, 200, { ok: true, settings: saved });
    }
    if (p === '/api/admin/settings') return json(res, 200, { settings: store.settings() });

    if (p === '/api/admin/pot' && req.method === 'POST') {
      const body = await readBody(req);
      const sol = Number(body && body.pot);
      if (!isFinite(sol) || sol < 0) return json(res, 400, { error: 'bad amount' });
      const r = store.setPot(body.id, sol);
      if (!r) return json(res, 404, { error: 'unknown round' });
      broadcast('pot', { roundId: r.id, pot: sol, final: true });
      return json(res, 200, { ok: true, round: r });
    }
    if (p === '/api/admin/rounds.csv') {
      const rows = [['round', 'time_utc', 'winner_wallet', 'pot_usd', 'fees_usd', 'fees_eth', 'players', 'paid', 'tx']];
      for (const r of store.recent(500)) {
        rows.push([r.id, new Date(r.startAt).toISOString(), r.winner || '',
          r.pot === null || r.pot === undefined ? '' : r.pot,
          r.gross === null || r.gross === undefined ? '' : r.gross,
          r.grossEth === null || r.grossEth === undefined ? '' : r.grossEth,
          (r.players || []).length, r.paid ? 'yes' : 'no', r.tx || '']);
      }
      const csv = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
      res.writeHead(200, {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="marble-royale-rounds.csv"'
      });
      return res.end(csv);
    }
    return json(res, 404, { error: 'no such admin route' });
  }

  /* --- pages --- */
  if (p === '/' ) return serveFile(res, 'index.html');
  if (p === '/admin') return serveFile(res, 'admin.html');
  if (p === '/verify') return serveFile(res, 'verify.html');
  if (p === '/health') return json(res, 200, { ok: true, round: rounds.publicRound()?.id, watching: clients.size });
  return serveFile(res, p.replace(/^\/+/, ''));
});

server.listen(PORT, () => {
  rounds.start();
  console.log('MARBLERUSH on :' + PORT +
    ' | round ' + Math.round(ROUND_MS / 1000) + 's' +
    ' | fee wallet ' + (FEE_WALLET || 'not set') + ' | rpc ' + chain.RPC +
    ' | admin ' + (ADMIN_KEY ? 'on' : 'OFF (set ADMIN_KEY)'));
});
