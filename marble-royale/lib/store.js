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

let state = { rounds: [], stats: {} };
let writing = false, again = false;

function load() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.rounds)) {
      state = { rounds: parsed.rounds, stats: parsed.stats || {} };
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
  for (const addr of round.players || []) {
    const s = state.stats[addr] || { wins: 0, races: 0 };
    s.races++;
    state.stats[addr] = s;
  }
  save();
}

const findRound = (id) => state.rounds.find((r) => r.id === id) || null;

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

module.exports = { load, save, addRound, findRound, markPaid, setPot, recent, statsFor, top, unpaid, FILE };
