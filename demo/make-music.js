/* Writes demo/music.wav — an original 25 second bed for the demo video.
 *
 * Nothing sampled and no dependencies: every voice is synthesised here, so the
 * track carries no licence of its own. 96 BPM, ten bars of 4/4, Am7 - Fmaj7 -
 * Cmaj7 - G - Am7, arranged to come in under the opening shot and thin back out
 * over the closing one.
 */
const fs = require('fs');
const path = require('path');

const SR = 44100;
const BEAT = 60 / 96;
const BAR = BEAT * 4;
const BARS = 10;
const DUR = BAR * BARS;                 // 25.0s, the length of the video
const N = Math.round(DUR * SR);

const L = new Float32Array(N);
const R = new Float32Array(N);
const WET = new Float32Array(N);        // what gets sent to the reverb

// seeded, so the same track comes out of every run
let seed = 0x9e3779b9;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// two bars per chord: root for the bass, then the voicing
const PROG = [
  { bass: 45, notes: [57, 60, 64, 67] },  // Am7
  { bass: 41, notes: [53, 57, 60, 64] },  // Fmaj7
  { bass: 48, notes: [60, 64, 67, 71] },  // Cmaj7
  { bass: 43, notes: [55, 59, 62, 67] },  // G
  { bass: 45, notes: [57, 60, 64, 67] }   // Am7, ringing out
];
const chordAt = (bar) => PROG[Math.floor(bar / 2)];

/* ---------- voices ---------- */

// band-limited saw: harmonics are dropped once they would alias
function addPad(start, dur, midi, gain, pan) {
  const attack = 0.55, release = 0.9;
  const i0 = Math.round(start * SR);
  const i1 = Math.min(N, Math.round((start + dur + release) * SR));
  for (const cents of [-6, 6]) {
    const f = mtof(midi) * Math.pow(2, cents / 1200);
    const partials = Math.max(1, Math.min(14, Math.floor(6500 / f)));
    const phase = rnd() * Math.PI * 2;
    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / SR;
      const env = t < attack
        ? clamp01(t / attack)
        : t < dur ? 1 : Math.exp(-(t - dur) / (release / 3));
      let s = 0;
      for (let k = 1; k <= partials; k++) s += Math.sin(2 * Math.PI * f * k * t + phase) / k;
      const v = s * env * gain * 0.5;
      const p = pan * (cents < 0 ? -1 : 1);
      L[i] += v * (0.5 - p * 0.5);
      R[i] += v * (0.5 + p * 0.5);
      WET[i] += v * 0.35;
    }
  }
}

function addPluck(start, midi, gain, pan) {
  const f = mtof(midi);
  const i0 = Math.round(start * SR);
  const i1 = Math.min(N, i0 + Math.round(0.9 * SR));
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    const env = Math.exp(-t * 7) * clamp01(t / 0.004);
    const s = Math.sin(2 * Math.PI * f * t)
      + 0.32 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t * 14)
      + 0.12 * Math.sin(6 * Math.PI * f * t) * Math.exp(-t * 22);
    const v = s * env * gain;
    L[i] += v * (0.5 - pan * 0.5);
    R[i] += v * (0.5 + pan * 0.5);
    WET[i] += v * 0.5;
  }
}

function addBass(start, dur, midi, gain) {
  const f = mtof(midi);
  const i0 = Math.round(start * SR);
  const i1 = Math.min(N, Math.round((start + dur + 0.25) * SR));
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    const env = clamp01(t / 0.03) * (t < dur ? 1 : Math.exp(-(t - dur) * 12)) * (0.75 + 0.25 * Math.exp(-t * 2.2));
    const s = Math.sin(2 * Math.PI * f * t) + 0.22 * Math.sin(4 * Math.PI * f * t);
    const v = s * env * gain;
    L[i] += v * 0.5; R[i] += v * 0.5;
  }
}

function addKick(start, gain) {
  const i0 = Math.round(start * SR);
  const i1 = Math.min(N, i0 + Math.round(0.35 * SR));
  let phase = 0;
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    const f = 45 + 85 * Math.exp(-t * 42);
    phase += (2 * Math.PI * f) / SR;
    const v = Math.sin(phase) * Math.exp(-t * 11) * gain;
    L[i] += v * 0.5; R[i] += v * 0.5;
  }
}

function addHat(start, gain, pan) {
  const i0 = Math.round(start * SR);
  const i1 = Math.min(N, i0 + Math.round(0.12 * SR));
  let prev = 0, hp = 0;
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR;
    const noise = rnd() * 2 - 1;
    hp = 0.85 * (hp + noise - prev);          // one-pole highpass, keeps only the fizz
    prev = noise;
    const v = hp * Math.exp(-t * 55) * gain;
    L[i] += v * (0.5 - pan * 0.5);
    R[i] += v * (0.5 + pan * 0.5);
    WET[i] += v * 0.25;
  }
}

/* ---------- the arrangement ---------- */

const ARP = [0, 2, 1, 3, 2, 0, 3, 1];       // eighths, indexing into the chord

for (let bar = 0; bar < BARS; bar++) {
  const t0 = bar * BAR;
  const chord = chordAt(bar);

  if (bar % 2 === 0) {                       // one pad hit per chord, held two bars
    chord.notes.forEach((m, i) =>
      addPad(t0, BAR * 2 + 0.3, m, 0.16, (i - 1.5) / 2.4));   // overlaps the next chord
  }

  addBass(t0, BAR - 0.08, chord.bass, bar < 2 ? 0.24 : 0.34);

  if (bar >= 2 && bar <= 8) {                // arp carries the middle of the video
    const level = bar === 8 ? 0.06 : 0.1;
    for (let e = 0; e < 8; e++) {
      if (bar === 8 && e % 2 === 1) continue; // thin it out under the closing shot
      const midi = chord.notes[ARP[e]] + 12;
      addPluck(t0 + e * BEAT / 2, midi, level * (e % 2 === 0 ? 1 : 0.72), ((e % 4) - 1.5) / 4);
    }
  }

  if (bar >= 2 && bar <= 8) {
    addKick(t0, 0.5);
    addKick(t0 + BEAT * 2, 0.42);
    if (bar >= 4 && bar <= 7) addKick(t0 + BEAT * 3.5, 0.22);
  }

  if (bar >= 3 && bar <= 7) {
    for (let e = 0; e < 4; e++) addHat(t0 + (e + 0.5) * BEAT, 0.05, e % 2 ? 0.3 : -0.3);
  }
}

/* ---------- a small room around it ---------- */

function comb(input, out, delayMs, feedback, damp) {
  const d = Math.round((delayMs / 1000) * SR);
  const buf = new Float32Array(d);
  let store = 0, idx = 0;
  for (let i = 0; i < input.length; i++) {
    const y = buf[idx];
    store = y * (1 - damp) + store * damp;
    buf[idx] = input[i] + store * feedback;
    out[i] += y;
    if (++idx === d) idx = 0;
  }
}

function allpass(io, delayMs, g) {
  const d = Math.round((delayMs / 1000) * SR);
  const buf = new Float32Array(d);
  let idx = 0;
  for (let i = 0; i < io.length; i++) {
    const y = buf[idx];
    const x = io[i];
    io[i] = -x + y;
    buf[idx] = x + y * g;
    if (++idx === d) idx = 0;
  }
}

const tail = new Float32Array(N);
for (const [ms, fb] of [[29.7, 0.79], [37.1, 0.78], [41.1, 0.77], [43.7, 0.76]]) comb(WET, tail, ms, fb, 0.32);
allpass(tail, 5.0, 0.7);
allpass(tail, 1.7, 0.7);
for (let i = 0; i < N; i++) {
  const v = (tail[i] / 4) * 0.24;
  L[i] += v; R[i] += v * 0.94;
}

/* ---------- master ---------- */

const fadeIn = 1.1 * SR;
const fadeOut = 3.0 * SR;
let peak = 0;
for (let i = 0; i < N; i++) {
  let g = 1;
  if (i < fadeIn) g *= i / fadeIn;
  if (i > N - fadeOut) g *= Math.pow((N - i) / fadeOut, 1.6);
  L[i] = Math.tanh(L[i] * g * 1.15);
  R[i] = Math.tanh(R[i] * g * 1.15);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.72 / peak;                    // sits a few dB below full scale

const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8);
out.write('fmt ', 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28);
out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  out.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * norm * 32767))), 44 + i * 4);
  out.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * norm * 32767))), 46 + i * 4);
}

const file = path.join(__dirname, 'music.wav');
fs.writeFileSync(file, out);
console.log(`wrote ${path.basename(file)} — ${DUR.toFixed(1)}s, peak ${(20 * Math.log10(0.72)).toFixed(1)} dBFS`);
