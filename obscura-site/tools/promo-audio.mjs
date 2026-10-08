// Synthesizes the soundtrack for tools/promo.html: our own music and sound
// effects, timed to the film's scenes, so there is nothing to license.
// 138 BPM in A minor, driving from the first second: a pumping pad on Am–F–C–G,
// off-beat bass, four-on-the-floor drums with a drop on "Nothing else.",
// a key click per typed letter, whooshes on cuts, UI clicks and pops, a hit on
// the burst and a last chord that rings out.
//
//   node tools/promo-audio.mjs out.wav
import { writeFileSync } from "node:fs";

const SR = 44100, DUR = 30.5, N = Math.ceil(SR * DUR);
const L = new Float32Array(N), R = new Float32Array(N), FX = new Float32Array(N); // FX: sent to the reverb
const BEAT = 60 / 138, GRID = 0.1, BAR2 = 8 * BEAT; // beats fall on 0.1 + k * BEAT
// the pad ducks on every kick, the pumping sound of the style
const duck = (t) => { if (!drums(t)) return 1; const ph = ((t - GRID) % BEAT + BEAT) % BEAT; return 0.45 + 0.55 * (1 - Math.exp(-ph * 9)); };

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

function add(i, v, pan = 0, send = 0) {
  if (i < 0 || i >= N) return;
  L[i] += v * (1 - Math.max(0, pan)); R[i] += v * (1 + Math.min(0, pan)); FX[i] += v * send;
}

// one-pole low-pass state per voice
function voice(t0, dur, fn, { pan = 0, send = 0, cutoff = 0 } = {}) {
  const a = cutoff ? 1 - Math.exp(-2 * Math.PI * cutoff / SR) : 1;
  let y = 0;
  const i0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  for (let k = 0; k < n; k++) {
    const x = fn(k / SR);
    y += a * (x - y);
    add(i0 + k, y, pan, send);
  }
}

const env = (t, att, dur, rel) => (t < att ? t / att : t > dur - rel ? Math.max(0, (dur - t) / rel) : 1);
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));

// ---------- pad: Am – F – C – G, two seconds each ----------
const CHORDS = [[57, 60, 64, 69], [53, 57, 60, 65], [55, 60, 64, 67], [55, 59, 62, 67]];
for (let c = 0, t = 0; t < 27.6; c++, t += BAR2) {
  const notes = CHORDS[c % 4];
  const len = Math.min(BAR2 + 0.4, 27.9 - t);
  const lvl = 0.05;
  notes.forEach((m, j) => {
    for (const det of [-0.08, 0.08]) {
      const f = hz(m) * (1 + det / 100 * 1.5);
      voice(t, len, (x) => lvl * duck(t + x) * env(x, 0.2, len, 0.4) * saw(f * x + j * 0.13), { pan: det * 5, send: 0.25, cutoff: 1600 });
    }
  });
}

// ---------- drums and bass ----------
function drums(t) { return (t >= 0.1 && t < 19.6) || (t >= 22.0 && t < 26.4); }
const full = (t) => (t >= 2.1 && t < 19.6) || (t >= 22.0 && t < 26.4);
const ROOTS = [45, 41, 48, 43]; // A2 F2 C3 G2
for (let k = 0; ; k++) {
  const t = GRID + k * BEAT;
  if (t > 27) break;
  if (drums(t)) {
    // kick: a falling sine
    voice(t, 0.32, (x) => (t < 2.1 ? 0.4 : 0.55) * Math.exp(-x * 10) * Math.sin(2 * Math.PI * (45 * x + (105 / 18) * (1 - Math.exp(-x * 18)))));
    if (full(t)) {
      // open hat on the off-beat, closed sixteenths around it
      voice(t + BEAT / 2, 0.08, (x) => 0.055 * Math.exp(-x * 45) * rnd(), { pan: 0.3, cutoff: 9000 });
      for (const q of [1, 3]) voice(t + q * BEAT / 4, 0.03, (x) => 0.022 * Math.exp(-x * 150) * rnd(), { pan: -0.25, cutoff: 9000 });
      // clap on 2 and 4
      if (k % 2 === 1) voice(t, 0.2, (x) => 0.16 * Math.exp(-x * 22) * rnd(), { send: 0.4, cutoff: 3500 });
    }
    // bass: eighths on the chord's root
    // bass on the off-beat, between the kicks
    const root = ROOTS[Math.floor(t / BAR2) % 4];
    if (full(t)) voice(t + BEAT / 2, 0.19, (x) => 0.2 * Math.exp(-x * 10) * (Math.sin(2 * Math.PI * hz(root) * x) + 0.35 * saw(hz(root) * x)), { cutoff: 700 });
  }
}

// ---------- typing: one click per letter ----------
const typing = [[2.5, 15, 6], [4.65, 34, 18], [5.45, 34, 15], [19.65, 16, 13]];
for (const [t0, cps, n] of typing) {
  for (let i = 0; i < n; i++) {
    const t = t0 + i / cps, pan = ((i * 7) % 5 - 2) / 8;
    voice(t, 0.03, (x) => 0.22 * Math.exp(-x * 260) * (rnd() * 0.7 + 0.3 * Math.sin(2 * Math.PI * 2400 * x)), { pan });
  }
}

// ---------- whooshes into each cut ----------
for (const cut of [2.1, 4.6, 6.8, 10.4, 13.4, 16.4, 19.6, 22.0, 25.6, 27.6]) {
  const d = 0.42;
  let lp = 0;
  voice(cut - d, d + 0.05, (x) => { const k = Math.min(1, x / d); lp += (0.04 + 0.4 * k) * (rnd() - lp); return 0.08 * k * k * lp * 3; }, { send: 0.3 });
}

// ---------- a riser into the beat's return after "Nothing else." ----------
{ let lp = 0; voice(20.6, 1.4, (x) => { const k = x / 1.4; lp += (0.02 + 0.3 * k) * (rnd() - lp); return 0.2 * k ** 2 * lp * 3; }, { send: 0.4 }); }

// ---------- UI sounds ----------
const blip = (t, f0, f1, amp = 0.2, d = 0.12) => voice(t, d, (x) => amp * Math.exp(-x * 28) * Math.sin(2 * Math.PI * (f0 * x + (f1 - f0) * x * x / (2 * d))), { send: 0.35 });
const click = (t) => voice(t, 0.04, (x) => 0.3 * Math.exp(-x * 180) * (0.6 * rnd() + 0.4 * Math.sin(2 * Math.PI * 1200 * x)));
click(8.0);                          // ETH picked
blip(8.3, 700, 500, 0.08); blip(8.45, 700, 500, 0.07); blip(8.6, 700, 500, 0.06); // rows sealed
click(12.1);                         // Sign
blip(12.55, 880, 1320);              // Proof sealed
click(14.4);                         // Copy link
blip(14.5, 880, 1320);               // Link copied
blip(16.95, hz(76), hz(76), 0.16, 0.5); blip(17.08, hz(81), hz(81), 0.16, 0.6); // Proven
[17.15, 17.4, 17.65].forEach((t, i) => blip(t, hz(84 + i * 3), hz(84 + i * 3), 0.1, 0.15)); // checks
for (let k = 0; k < 5; k++) blip(22.0 + k * 0.72, hz(88), hz(88), 0.07, 0.1); // feature steps

// ---------- the burst: a hit with a sub drop ----------
voice(26.45, 1.6, (x) => 0.7 * Math.exp(-x * 3) * Math.sin(2 * Math.PI * (38 * x + 60 / 6 * (1 - Math.exp(-x * 6)))), { send: 0.3 });
voice(26.45, 0.8, (x) => 0.35 * Math.exp(-x * 7) * rnd(), { send: 0.8, cutoff: 2500 });

// ---------- end: one chord that rings out ----------
for (const [m, a] of [[45, 0.12], [57, 0.14], [64, 0.12], [69, 0.12], [71, 0.08], [76, 0.1]]) {
  voice(27.6, 2.9, (x) => a * Math.exp(-x * 0.8) * (Math.sin(2 * Math.PI * hz(m) * x) + 0.25 * Math.sin(2 * Math.PI * 2 * hz(m) * x)), { send: 0.6, pan: (m - 66) / 30 });
}

// ---------- reverb: a few feedback delays on the send bus ----------
const taps = [[0.0297, 0.62], [0.0371, 0.6], [0.0411, 0.58], [0.0437, 0.56]];
for (const [d, g] of taps) {
  const n = Math.floor(d * SR), buf = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    buf[i] = FX[i] + (i >= n ? buf[i - n] * g : 0);
    const v = buf[i] * 0.12;
    if (d < 0.04) L[i] += v; else R[i] += v;
  }
}

// ---------- master: fade, soft clip, 16-bit WAV ----------
const out = Buffer.alloc(44 + N * 4);
out.write("RIFF", 0); out.writeUInt32LE(36 + N * 4, 4); out.write("WAVE", 8);
out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write("data", 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = Math.min(1, t / 0.05, (DUR - t) / 0.9);
  const l = Math.tanh(L[i] * 1.2) * fade, r = Math.tanh(R[i] * 1.2) * fade;
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l)) * 32000), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r)) * 32000), 46 + i * 4);
}
writeFileSync(process.argv[2] || "promo.wav", out);
console.log(`wrote ${process.argv[2] || "promo.wav"}: ${DUR} s`);
