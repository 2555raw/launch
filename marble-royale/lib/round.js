/* The five minute cycle.

   Every round is pinned to the wall clock, so a round starts at :00, :05, :10
   and so on and two people in different countries see the same countdown. A
   round runs through four phases:

     lobby      connect a wallet, get a marble          (most of the five minutes)
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
const solana = require('./solana');

const ROUND_MS = Math.max(90000, Number(process.env.ROUND_MS) || 300000);
const RESULT_MS = 25000;
const RACE_MAX_MS = (RACE.MAX_SECONDS + 5) * 1000;
const LOCK_MS = 5000;
const LOBBY_MS = ROUND_MS - RESULT_MS - RACE_MAX_MS - LOCK_MS;
const MAX_PLAYERS = Math.max(2, Number(process.env.MAX_PLAYERS) || 250);
const FEE_WALLET = process.env.FEE_WALLET || '';
/* What the winner takes out of the fees that came in during the round. The rest
   stays where it is. Whoever runs the game picks the number and it is on screen,
   because a pot nobody can check is a pot nobody believes. */
const POT_PCT = Math.min(100, Math.max(0, Number(process.env.POT_PCT) || 20));
const FACES = ['none', 'smile', 'grin', 'wink', 'cool', 'angry', 'dead'];

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const startOf = (t) => Math.floor(t / ROUND_MS) * ROUND_MS;

class Rounds extends EventEmitter {
  constructor() {
    super();
    this.round = null;
    this.waitlist = [];      // addresses that arrived at a full race
    this.timer = null;
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
      startAt,
      raceAt: startAt + LOBBY_MS + LOCK_MS,
      lockAt: startAt + LOBBY_MS,
      endAt: startAt + ROUND_MS,
      phase: 'lobby',
      secret,
      commit: sha256(secret),
      seed: null,
      players: [],            // [{address, joinedAt, color, face}]
      index: new Map(),
      order: null,
      winner: null,
      seconds: 0,
      pot: null,
      gross: null,
      baseline: null,
      potFinal: false
    };

    /* Anyone turned away from a full race walks straight into this one. */
    const queued = this.waitlist.splice(0, MAX_PLAYERS);
    for (const addr of queued) this.join(addr, true);

    this.emit('phase', this.publicRound());
    this.readBaseline();
    this.at(r.lockAt, () => this.lock());
  }

  async readBaseline() {
    if (!FEE_WALLET) return;
    const r = this.round;
    const lamports = await solana.balance(FEE_WALLET);
    if (this.round === r && lamports !== null) {
      r.baseline = lamports;
      this.pollPot();
    }
  }

  /* What the fee wallet has taken in since this round opened. */
  async pollPot() {
    const r = this.round;
    if (!FEE_WALLET || r.baseline === null) return;
    const lamports = await solana.balance(FEE_WALLET);
    if (this.round !== r || lamports === null) return;
    const gross = Math.max(0, lamports - r.baseline);
    const sol = solana.toSol(gross * (POT_PCT / 100));
    if (r.pot !== sol) {
      r.gross = solana.toSol(gross);
      r.pot = sol;
      this.emit('pot', { roundId: r.id, pot: sol, gross: r.gross, pct: POT_PCT, final: r.potFinal });
    }
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
    const outcome = RACE.runToEnd(r.seed, marbles);
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
      players: r.players.map((p) => ({ address: p.address, color: p.color, face: p.face }))
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
      potPct: POT_PCT,
      paid: false,
      tx: ''
    });

    this.emit('result', {
      roundId: r.id,
      winner: r.winner,
      pot: r.pot,
      gross: r.gross,
      pct: POT_PCT,
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
    if (FEE_WALLET && r.baseline !== null) {
      const lamports = await solana.balance(FEE_WALLET);
      if (lamports !== null) {
        const gross = Math.max(0, lamports - r.baseline);
        r.gross = solana.toSol(gross);
        r.pot = solana.toSol(gross * (POT_PCT / 100));
        r.potFinal = true;
        const saved = store.findRound(r.id);
        if (saved && !saved.potManual) { saved.pot = r.pot; store.save(); }
        this.emit('pot', { roundId: r.id, pot: r.pot, gross: r.gross, pct: POT_PCT, final: true });
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

  /* ---- joining ---------------------------------------------------------- */

  join(address, fromWaitlist, skin) {
    const r = this.round;
    if (!r) return { error: 'starting' };
    if (r.phase !== 'lobby') return { error: 'closed' };
    if (r.index.has(address)) return { error: 'already', player: r.index.get(address) };
    if (r.players.length >= MAX_PLAYERS) {
      if (!this.waitlist.includes(address)) this.waitlist.push(address);
      return { error: 'full', queued: this.waitlist.indexOf(address) + 1 };
    }
    const player = {
      address,
      joinedAt: Date.now(),
      color: cleanColor(skin && skin.color) || colorOf(address),
      face: FACES.includes(skin && skin.face) ? skin.face : faceOf(address)
    };
    r.players.push(player);
    r.index.set(address, player);
    if (!fromWaitlist) this.emit('join', { roundId: r.id, player, count: r.players.length });
    return { player, count: r.players.length };
  }

  /* ---- what the browser is told ----------------------------------------- */

  publicRound() {
    const r = this.round;
    if (!r) return null;
    return {
      id: r.id,
      phase: r.phase,
      startAt: r.startAt,
      lockAt: r.lockAt,
      raceAt: r.raceAt,
      endAt: r.endAt,
      commit: r.commit,
      seed: r.phase === 'lobby' || r.phase === 'locked' && !r.seed ? null : r.seed,
      secret: r.phase === 'result' || r.phase === 'racing' ? r.secret : null,
      pot: r.pot,
      gross: r.gross,
      potPct: POT_PCT,
      potFinal: r.potFinal,
      players: r.players.map((p) => ({ address: p.address, color: p.color, face: p.face })),
      count: r.players.length,
      max: MAX_PLAYERS,
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

function faceOf(address) {
  let h = 5381;
  for (let i = 0; i < address.length; i++) h = (Math.imul(h, 33) ^ address.charCodeAt(i)) >>> 0;
  return FACES[1 + (h % (FACES.length - 1))];
}

/* A marble's colour is its address, so a wallet that picks nothing still has a
   colour of its own, the same one in every race. */
function colorOf(address) {
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

module.exports = { Rounds, ROUND_MS, LOBBY_MS, LOCK_MS, RACE_MAX_MS, RESULT_MS, MAX_PLAYERS, FEE_WALLET, POT_PCT, FACES, colorOf, faceOf, cleanColor, sha256 };
