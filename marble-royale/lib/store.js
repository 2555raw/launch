/* Where the results live.

   A race hands out real money, so the winner of every round has to survive a
   restart, a redeploy and a laptop closing. This is a JSON file written after
   every change - no database, no dependency, and a file you can open and read
   when someone asks who won at 14:35. Point DATA_DIR at a Railway volume and it
   survives deploys too; leave it and it lives next to the code, which is fine
   for a first run but is wiped when the container is replaced. */

'use strict';

const fs = require('fs');
const path = require('path');

const DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'rounds.json');
const KEEP = 500;                 // rounds kept in the file and in memory

let state = { rounds: [], stats: {}, counter: 0, launches: [], settings: {} };
let writing = false, again = false;

function load() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.rounds)) {
      state = { rounds: parsed.rounds, stats: parsed.stats || {}, counter: parsed.counter || parsed.rounds.length, launches: Array.isArray(parsed.launches) ? parsed.launches : [], settings: (parsed.settings && typeof parsed.settings === 'object') ? parsed.settings : {} };
    }
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[store] could not read ' + FILE + ':', err.message);
  }
  return state;
}

/* Writes to a temporary file and renames it over the real one, so a crash
   halfway through leaves the old results rather than half of the new ones. */
function save() {
  if (writing) { again = true; return; }
  writing = true;
  const tmp = FILE + '.tmp';
  const body = JSON.stringify(state);
  fs.mkdir(DIR, { recursive: true }, (e1) => {
    if (e1) { writing = false; return console.error('[store]', e1.message); }
    fs.writeFile(tmp, body, (e2) => {
      if (e2) { writing = false; return console.error('[store]', e2.message); }
      fs.rename(tmp, FILE, (e3) => {
        writing = false;
        if (e3) console.error('[store]', e3.message);
        if (again) { again = false; save(); }
      });
    });
  });
}

function addRound(round) {
  state.rounds.unshift(round);
  if (state.rounds.length > KEEP) state.rounds.length = KEEP;
  if (round.winner) {
    const s = state.stats[round.winner] || { wins: 0, races: 0 };
    s.wins++;
    state.stats[round.winner] = s;
  }
  /* a field is a list of players now and was a list of addresses before */
  for (const p of round.players || []) {
    const addr = typeof p === 'string' ? p : p && p.address;
    if (!addr) continue;
    const s = state.stats[addr] || { wins: 0, races: 0 };
    s.races++;
    state.stats[addr] = s;
  }
  save();
}

const findRound = (id) => state.rounds.find((r) => r.id === id) || null;
/* Race numbers are what people read and share, so a round can be found by one. */
const findByNumber = (n) => state.rounds.find((r) => Number(r.number) === Number(n)) || null;

/* Rounds are numbered for people - RACE #0248 - and the number only ever
   goes up, whatever happens to the file of results. */
function nextNumber() {
  state.counter = (state.counter || 0) + 1;
  save();
  return state.counter;
}
const currentNumber = () => state.counter || 0;

/* Clearing the race log: the rounds, the per-wallet stats and the numbering
   go, the launches and the creator's settings stay. Used once, deliberately,
   from the creator console; there is no undo. */
function resetRounds() {
  const had = state.rounds.length;
  state.rounds = [];
  state.stats = {};
  state.counter = 0;
  save();
  return had;
}

function markPaid(id, signature) {
  const r = findRound(id);
  if (!r) return null;
  r.paid = true;
  r.paidAt = Date.now();
  r.tx = signature || '';
  save();
  return r;
}

function setPot(id, sol) {
  const r = findRound(id);
  if (!r) return null;
  r.pot = sol;
  r.potManual = true;
  save();
  return r;
}

const recent = (n) => state.rounds.slice(0, n);
const statsFor = (addr) => state.stats[addr] || { wins: 0, races: 0 };

/* The leaderboard people actually look at: most wins, then most races. */
function top(n) {
  return Object.entries(state.stats)
    .map(([address, s]) => ({ address, wins: s.wins, races: s.races }))
    .sort((a, b) => b.wins - a.wins || b.races - a.races || a.address.localeCompare(b.address))
    .slice(0, n);
}

const unpaid = () => state.rounds.filter((r) => r.winner && !r.paid);

/* The rewards: rounds the creator has marked paid, newest first, and what
   they add up to. What the page's Rewards list shows. */
function paid(n) {
  return recent(500).filter((r) => r.paid && r.winner).sort((a, b) => (b.paidAt || b.startAt) - (a.paidAt || a.startAt)).slice(0, n || 10);
}
function paidTotal() {
  let t = 0;
  for (const r of recent(5000)) if (r.paid && r.pot) t += Number(r.pot) || 0;
  return Math.round(t * 100) / 100;
}

/* What the creator sets from the console while the site is running: the
   token's contract address and the links that go with it. Kept in the same
   file as the results so a redeploy does not lose them. */
function settings() { return Object.assign({}, state.settings); }
function setSettings(patch) {
  state.settings = Object.assign({}, state.settings, patch);
  for (const k of Object.keys(state.settings)) if (state.settings[k] === '' || state.settings[k] === null) delete state.settings[k];
  save();
  return settings();
}

/* Tokens launched through the site, newest first; one entry per token. */
function addLaunch(l) {
  state.launches = (state.launches || []).filter((x) => x.token.toLowerCase() !== l.token.toLowerCase());
  state.launches.unshift(l);
  if (state.launches.length > 300) state.launches.length = 300;
  save();
  return l;
}
function launches(n) { return (state.launches || []).slice(0, n || 24); }

module.exports = { resetRounds, settings, setSettings, addLaunch, launches, load, save, addRound, findRound, findByNumber, markPaid, setPot, recent, statsFor, top, unpaid, paid, paidTotal, nextNumber, currentNumber, FILE };
