/* The ten minute cycle.

   Every round is pinned to the wall clock, so a round starts at :00, :10, :20
   and so on and two people in different countries see the same countdown. A
   round runs through four phases:

     lobby      connect a wallet, get a marble          (most of the ten minutes)
     locked     the field is closed, the seed is out    (5s)
     racing     the race everyone watches               (up to 45s)
     result     the winner and the wallet to pay        (the rest)

   Fairness is the part worth reading. Before anyone joins, the server draws a
   secret at random and publishes only sha256(secret) - a promise it cannot take
   back. When the field closes, the race seed is sha256(secret + the list of
   players) and the secret is published with it. Anyone can check afterwards that
   the hash they were shown at the start really is the hash of the secret, and
   that the seed really came from that secret and that field. So the server
   cannot look at who joined and pick a seed where its own wallet wins, and it
   cannot swap the field either. The seed decides the course, the starting slots
   and every bounce, so with the seed the race can be replayed anywhere - the
   engine is the same file the browser runs. */

'use strict';

const crypto = require('crypto');
const { EventEmitter } = require('events');
const RACE = require('../public/shared/race.js');
const store = require('./store');
const chain = require('./chain');

const ROUND_MS = Math.max(90000, Number(process.env.ROUND_MS) || 600000);
/* A minute after the race: the podium, the address to pay, and the vote on
   the next track. */
const RESULT_MS = 60000;
const RACE_MAX_MS = (RACE.MAX_SECONDS + 5) * 1000;
const LOCK_MS = 5000;
const LOBBY_MS = ROUND_MS - RESULT_MS - RACE_MAX_MS - LOCK_MS;
/* The grid opens at thirty places. Once it is most of the way full it grows
   to fifty for that race, so a busy night is not a queue; a quiet one still
   looks like a race and not an empty hall. */
const MAX_PLAYERS = Math.max(2, Number(process.env.MAX_PLAYERS) || 30);
const MAX_PLAYERS_HIGH = Math.max(MAX_PLAYERS, Number(process.env.MAX_PLAYERS_HIGH) || 50);
const GROW_AT = Math.ceil(MAX_PLAYERS * 0.8);
/* How long before the next round opens the poll closes, so the page has a
   moment to say which track won before the lobby for it appears. */
const POLL_CLOSE_MS = 2000;
const FEE_WALLET = process.env.FEE_WALLET || '';
/* With no fee wallet to read and demo mode on, the pot is acted: it climbs a
   cent at a time to a few dollars over the queue, twenty-five on a mega race,
   and every figure it sends is marked demo so the page can say so. */
const DEMO_POT = process.env.DEMO_MODE === '1' && !FEE_WALLET;
/* What the winner takes out of the fees that came in during the round. The rest
   stays where it is. Whoever runs the game picks the number and it is on screen,
   because a pot nobody can check is a pot nobody believes. */
const POT_PCT = Math.min(100, Math.max(0, Number(process.env.POT_PCT) || 20));
/* Every MEGA_EVERY_MS (the hour, on the hour, by default) the round is a
   mega race and the winner takes MEGA_PCT of the fees instead. The round says
   so from the moment it opens, so the page can badge it. */
const MEGA_EVERY_MS = Math.max(ROUND_MS, Number(process.env.MEGA_EVERY_MS) || 3600000);
const MEGA_PCT = Math.min(100, Math.max(0, Number(process.env.MEGA_PCT) || 50));
const MATERIALS = ['glass', 'metal', 'holo', 'neon', 'chrome', 'clear', 'lava', 'galaxy'];
const FACES = ['hood', 'doge', 'shib', 'pepe', 'bonk', 'wif', 'btc', 'eth', 'sol', 'bnb', 'xrp', 'usdt', 'usdc', 'ada', 'avax'];

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const startOf = (t) => Math.floor(t / ROUND_MS) * ROUND_MS;

class Rounds extends EventEmitter {
  constructor() {
    super();
    this.round = null;
    this.waitlist = [];      // addresses that arrived at a full race
    this.timer = null;
    this.pollTimer = null;
    /* The mode the next round races in, decided by the poll on the results
       screen of the round before. The first round of a fresh process is a
       classic. */
    this.nextMode = null;
    /* the last name each wallet raced under, so the chat can use it after
       the race is over and the field is gone */
    this.names = new Map();
  }

  start() {
    this.open(startOf(Date.now()));
  }

  /* ---- a round ---------------------------------------------------------- */

  open(startAt) {
    /* Never open a round whose lobby has already been and gone. A process that
       starts, or comes back from a crash, halfway through a five minute window
       would otherwise open a round that is instantly due to race, race it with
       nobody in it, and land straight back here - a loop of empty races. The
       next whole window is the one to wait for. */
    while (Date.now() > startAt + LOBBY_MS - 3000) startAt += ROUND_MS;

    const secret = crypto.randomBytes(32).toString('hex');
    const r = this.round = {
      id: 'R' + startAt,
      number: store.nextNumber(),
      startAt,
      raceAt: startAt + LOBBY_MS + LOCK_MS,
      lockAt: startAt + LOBBY_MS,
      endAt: startAt + ROUND_MS,
      phase: 'lobby',
      mega: startAt % MEGA_EVERY_MS === 0,
      mode: RACE.MODE_IDS.includes(this.nextMode) ? this.nextMode : 'classic',
      modeBy: RACE.MODE_IDS.includes(this.nextMode) ? 'vote' : 'default',
      max: MAX_PLAYERS,
      poll: null,
      secret,
      commit: sha256(secret),
      seed: null,
      players: [],            // [{address, joinedAt, color, face}]
      index: new Map(),
      order: null,
      winner: null,
      seconds: 0,
      pot: null,
      potDemo: false,
      gross: null,
      grossEth: null,
      baseline: null,
      potFinal: false
    };

    /* Anyone turned away from a full race walks straight into this one. */
    const queued = this.waitlist.splice(0, MAX_PLAYERS_HIGH);
    for (const addr of queued) this.join(addr, true);

    this.emit('phase', this.publicRound());
    this.readBaseline();
    if (DEMO_POT) {
      r.pot = 0;
      r.potDemo = true;
      r.potTarget = r.mega ? 25 : 4 + Math.random() * 3.5;
      clearInterval(this.demoTimer);
      this.demoTimer = setInterval(() => this.demoTick(), 1000);
    }
    this.at(r.lockAt, () => this.lock());
  }

  demoTick() {
    const r = this.round;
    if (!r || !DEMO_POT || r.phase !== 'lobby') return;
    const secs = Math.max(20, (r.lockAt - r.startAt) / 1000);
    const step = (r.potTarget / secs) * (0.5 + Math.random());
    r.pot = Math.min(r.potTarget, Math.round((r.pot + step) * 100) / 100);
    this.emit('pot', { roundId: r.id, pot: r.pot, potFull: r.potTarget, gross: null, grossEth: null, pct: 100, mega: r.mega, demo: true, final: false });
  }

  async readBaseline() {
    if (!FEE_WALLET) return;
    const r = this.round;
    const wei = await chain.balance(FEE_WALLET);
    if (this.round === r && wei !== null) {
      r.baseline = wei;
      this.pollPot();
    }
  }

  /* What the fee wallet has taken in since this round opened. */
  async pollPot() {
    const r = this.round;
    if (!FEE_WALLET || r.baseline === null) return;
    const wei = await chain.balance(FEE_WALLET);
    if (this.round !== r || wei === null) return;
    await this.settlePot(r, wei, false);
  }

  /* Fees are in wei; what people see is dollars. Both are kept: the gross ETH
     figure for the record, and the winner's share in USD at today's price. */
  async settlePot(r, wei, final) {
    const grossWei = wei > r.baseline ? wei - r.baseline : 0n;
    const grossUsd = await chain.weiToUsd(grossWei);
    r.grossEth = chain.toEth(grossWei);
    r.gross = grossUsd;
    const pct = r.mega ? MEGA_PCT : POT_PCT;
    r.pot = grossUsd === null ? null : Math.round(grossUsd * pct) / 100;
    r.potFinal = final;
    this.emit('pot', { roundId: r.id, pot: r.pot, potFull: this.potFull(r), gross: r.gross, grossEth: r.grossEth, pct, mega: r.mega, final });
  }

  lock() {
    const r = this.round;
    if (!r || r.phase !== 'lobby') return;
    r.phase = 'locked';

    /* The field is fixed here, in join order, and the seed follows from it. */
    const field = r.players.map((p) => p.address);
    r.seed = parseInt(sha256(r.secret + '|' + field.join(',')).slice(0, 8), 16) >>> 0;

    this.emit('phase', this.publicRound());
    this.at(r.raceAt, () => this.race());
  }

  race() {
    const r = this.round;
    if (!r || r.phase !== 'locked') return;

    if (r.players.length < 1) {
      /* Nobody showed up. Skip to the result screen and say so. */
      r.phase = 'result';
      r.order = [];
      this.emit('phase', this.publicRound());
      this.at(r.endAt, () => this.close());
      return;
    }

    r.phase = 'racing';
    const marbles = r.players.map((p) => ({ id: p.address }));
    const outcome = RACE.runToEnd(r.seed, marbles, r.mode);
    r.order = outcome.order;
    r.seconds = outcome.seconds;
    r.winner = outcome.order[0].id;

    /* The browsers replay the race from the seed; the result above is the one
       that counts and is sent again when the replay is due to be over. */
    this.emit('start', {
      roundId: r.id,
      seed: r.seed,
      secret: r.secret,
      commit: r.commit,
      startAt: r.raceAt,
      mode: r.mode,
      players: r.players.map((p) => ({ address: p.address, color: p.color, face: p.face, material: p.material, name: p.name }))
    });

    const showFor = Math.min(RACE_MAX_MS - 500, Math.ceil(outcome.seconds * 1000) + 1400);
    this.at(r.raceAt + showFor, () => this.result());
  }

  async result() {
    const r = this.round;
    if (!r || r.phase !== 'racing') return;
    r.phase = 'result';
    await this.pollPot();

    store.addRound({
      id: r.id,
      number: r.number,
      startAt: r.startAt,
      raceAt: r.raceAt,
      seed: r.seed,
      commit: r.commit,
      secret: r.secret,
      winner: r.winner,
      players: r.players.map((p) => p.address),
      order: r.order.slice(0, 20),
      seconds: r.seconds,
      pot: r.pot,
      gross: r.gross,
      grossEth: r.grossEth,
      potPct: r.mega ? MEGA_PCT : POT_PCT,
      mega: r.mega,
      mode: r.mode,
      paid: false,
      tx: ''
    });

    this.openPoll(r);
    this.emit('result', {
      roundId: r.id,
      number: r.number,
      mode: r.mode,
      poll: this.publicPoll(r),
      winner: r.winner,
      pot: r.pot,
      gross: r.gross,
      pct: r.mega ? MEGA_PCT : POT_PCT,
      mega: r.mega,
      seconds: r.seconds,
      order: r.order.slice(0, 10),
      secret: r.secret,
      commit: r.commit,
      seed: r.seed
    });
    this.at(r.endAt, () => this.close());
  }

  /* One last reading of the fee wallet, so the figure people are paid on covers
     the whole five minutes and not just the part before the race. */
  async close() {
    const r = this.round;
    if (!r) return;
    this.closePoll(r);
    if (FEE_WALLET && r.baseline !== null) {
      const wei = await chain.balance(FEE_WALLET);
      if (wei !== null) {
        await this.settlePot(r, wei, true);
        const saved = store.findRound(r.id);
        if (saved && !saved.potManual) { saved.pot = r.pot; saved.gross = r.gross; saved.grossEth = r.grossEth; store.save(); }
      }
    }
    this.open(startOf(Date.now()));
  }

  /* Timers are set against the clock rather than as delays, so a slow tick or a
     sleeping container cannot let the phases drift apart. */
  at(when, fn) {
    clearTimeout(this.timer);
    const wait = Math.max(0, when - Date.now());
    this.timer = setTimeout(fn, wait);
  }

  /* ---- the poll --------------------------------------------------------- */

  /* Two tracks, never the one just raced, go up on the results screen; the
     one with more votes is the next round's mode. A tie is a coin toss, so
     the mode always moves on. The poll is a preference, not part of the
     fairness scheme: the seed is committed after the mode is public. */
  openPoll(r) {
    const pool = RACE.MODE_IDS.filter((m) => m !== r.mode);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    r.poll = { a: pool[0], b: pool[1], votes: { [pool[0]]: 0, [pool[1]]: 0 }, voters: new Map(), closesAt: r.endAt - POLL_CLOSE_MS, winner: null };
    clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => this.closePoll(r), Math.max(0, r.poll.closesAt - Date.now()));
  }

  closePoll(r) {
    const p = r && r.poll;
    if (!p || p.winner) return;
    const va = p.votes[p.a], vb = p.votes[p.b];
    p.winner = va > vb ? p.a : vb > va ? p.b : (Math.random() < 0.5 ? p.a : p.b);
    this.nextMode = p.winner;
    this.emit('poll', this.publicPoll(r));
  }

  vote(address, choice) {
    const r = this.round;
    const p = r && r.poll;
    if (!p || r.phase !== 'result') return { error: 'no poll is open' };
    if (p.winner || Date.now() >= p.closesAt) return { error: 'the poll has closed' };
    if (choice !== p.a && choice !== p.b) return { error: 'that track is not on the poll' };
    const before = p.voters.get(address);
    if (before === choice) return { ok: true, poll: this.publicPoll(r) };
    if (before) p.votes[before]--;
    p.voters.set(address, choice);
    p.votes[choice]++;
    const out = this.publicPoll(r);
    this.emit('poll', out);
    return { ok: true, poll: out };
  }

  publicPoll(r) {
    const p = r && r.poll;
    if (!p) return null;
    return { roundId: r.id, a: p.a, b: p.b, votes: { [p.a]: p.votes[p.a], [p.b]: p.votes[p.b] }, total: p.votes[p.a] + p.votes[p.b], closesAt: p.closesAt, winner: p.winner };
  }

  /* ---- joining ---------------------------------------------------------- */

  join(address, fromWaitlist, skin) {
    const r = this.round;
    if (!r) return { error: 'starting' };
    if (r.phase !== 'lobby') return { error: 'closed' };
    if (r.index.has(address)) return { error: 'already', player: r.index.get(address) };
    if (r.players.length >= r.max) {
      if (!this.waitlist.includes(address)) this.waitlist.push(address);
      return { error: 'full', queued: this.waitlist.indexOf(address) + 1 };
    }
    const player = {
      address,
      joinedAt: Date.now(),
      color: cleanColor(skin && skin.color) || colorOf(address),
      face: FACES.includes(skin && skin.face) ? skin.face : faceOf(address),
      material: MATERIALS.includes(skin && skin.material) ? skin.material : materialOf(address),
      name: cleanName(skin && skin.name)
    };
    r.players.push(player);
    r.index.set(address, player);
    if (player.name) this.names.set(address, player.name);
    if (r.max < MAX_PLAYERS_HIGH && r.players.length >= GROW_AT) {
      r.max = MAX_PLAYERS_HIGH;
      this.emit('cap', { roundId: r.id, max: r.max, count: r.players.length });
    }
    if (!fromWaitlist) this.emit('join', { roundId: r.id, player, count: r.players.length, max: r.max });
    return { player, count: r.players.length, max: r.max };
  }

  /* A change of look or name while the queue is open. The address and the
     place in the field stay; only the decoration moves. */
  restyle(address, skin) {
    const r = this.round;
    if (!r || r.phase !== 'lobby') return { error: 'the queue is closed; the look is fixed for this race' };
    const player = r.index.get(address);
    if (!player) return { error: 'not in this race' };
    player.color = cleanColor(skin && skin.color) || player.color;
    player.face = FACES.includes(skin && skin.face) ? skin.face : player.face;
    player.material = MATERIALS.includes(skin && skin.material) ? skin.material : player.material;
    player.name = cleanName(skin && skin.name);
    if (player.name) this.names.set(address, player.name); else this.names.delete(address);
    const pub = { address: player.address, color: player.color, face: player.face, material: player.material, name: player.name };
    this.emit('skin', { roundId: r.id, player: pub });
    return { player: pub };
  }

  nameOf(address) {
    const r = this.round;
    const p = r && r.index.get(address);
    return (p && p.name) || this.names.get(address) || '';
  }

  /* What a full jar is: the acted target in demo mode, otherwise the larger of
     the expected take and the best of the last few real pots. */
  potFull(r) {
    if (r.potTarget) return r.potTarget;
    let best = r.mega ? 25 : 7.5;
    for (const past of store.recent(12)) if (past.pot > best) best = past.pot;
    return best;
  }

  /* The rounds ahead, on the clock, with the mega ones flagged: what the
     race list on the page shows. Numbers past the current one are what they
     will be, since numbers only go up by one per round. */
  schedule(n) {
    const r = this.round;
    if (!r) return [];
    const out = [];
    for (let i = 0; i < (n || 4); i++) {
      const startAt = r.startAt + i * ROUND_MS;
      out.push({
        id: 'R' + startAt,
        number: r.number + i,
        startAt,
        raceAt: startAt + LOBBY_MS + LOCK_MS,
        lockAt: startAt + LOBBY_MS,
        mega: startAt % MEGA_EVERY_MS === 0,
        open: i === 0 && r.phase === 'lobby',
        count: i === 0 ? r.players.length : this.waitlist.length,
        max: i === 0 ? r.max : MAX_PLAYERS,
        /* This round's mode is known; the next one's is known once its poll
           has closed; the ones after are decided by polls not yet held. */
        mode: i === 0 ? r.mode : i === 1 && r.poll && r.poll.winner ? r.poll.winner : null,
        modeBy: i === 0 ? r.modeBy : i === 1 && r.poll && r.poll.winner ? 'vote' : 'poll'
      });
    }
    return out;
  }

  /* ---- what the browser is told ----------------------------------------- */

  publicRound() {
    const r = this.round;
    if (!r) return null;
    return {
      id: r.id,
      number: r.number,
      phase: r.phase,
      mega: r.mega,
      mode: r.mode,
      modeBy: r.modeBy,
      poll: this.publicPoll(r),
      startAt: r.startAt,
      lockAt: r.lockAt,
      raceAt: r.raceAt,
      endAt: r.endAt,
      commit: r.commit,
      seed: r.phase === 'lobby' || r.phase === 'locked' && !r.seed ? null : r.seed,
      secret: r.phase === 'result' || r.phase === 'racing' ? r.secret : null,
      pot: r.pot,
      potFull: this.potFull(r),
      potDemo: !!r.potDemo,
      gross: r.gross,
      potPct: r.mega ? MEGA_PCT : POT_PCT,
      potFinal: r.potFinal,
      players: r.players.map((p) => ({ address: p.address, color: p.color, face: p.face, material: p.material, name: p.name })),
      count: r.players.length,
      max: r.max,
      winner: r.phase === 'result' ? r.winner : null,
      order: r.phase === 'result' && r.order ? r.order.slice(0, 10) : null,
      seconds: r.seconds
    };
  }
}

/* A skin arrives from a browser, so it is checked rather than trusted: a hex
   colour and a face from the list, or the ones the address would have had. */
function cleanColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

function materialOf(address) {
  let h = 7;
  for (let i = 0; i < address.length; i++) h = (Math.imul(h, 31) + address.charCodeAt(i)) >>> 0;
  return MATERIALS[h % MATERIALS.length];
}

/* A display name is letters, digits and a few marks, up to sixteen of them,
   or nothing: the short address then stands in. */
function cleanName(value) {
  if (typeof value !== 'string') return '';
  const v = value.replace(/[^\w .\-]/g, '').trim().slice(0, 16);
  return v;
}

function faceOf(address) {
  address = String(address).toLowerCase();
  let h = 5381;
  for (let i = 0; i < address.length; i++) h = (Math.imul(h, 33) ^ address.charCodeAt(i)) >>> 0;
  return FACES[h % FACES.length];
}

/* A marble's colour is its address, so a wallet that picks nothing still has a
   colour of its own, the same one in every race. */
function colorOf(address) {
  address = String(address).toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < address.length; i++) {
    h ^= address.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = h >>> 0;
  const hue = h % 360;
  const sat = 62 + (h >>> 9) % 26;
  const lit = 52 + (h >>> 17) % 14;
  return 'hsl(' + hue + ' ' + sat + '% ' + lit + '%)';
}

module.exports = { Rounds, ROUND_MS, LOBBY_MS, LOCK_MS, RACE_MAX_MS, RESULT_MS, MAX_PLAYERS, MAX_PLAYERS_HIGH, FEE_WALLET, POT_PCT, MEGA_PCT, MEGA_EVERY_MS, FACES, MATERIALS, colorOf, faceOf, cleanColor, sha256 };
