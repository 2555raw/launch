/* The sound manager.

   Every cue the game can make has a name here, and the rest of the app only
   ever asks for a name. Today each name is a small synthesised sound; drop a
   file in with load(name, url) and the same call plays the file instead.
   Nothing plays until the first tap, because browsers insist and because a
   page that starts making noise on its own deserves to be closed. */

(function () {
  'use strict';

  let ctx = null;
  let on = true;
  try { on = localStorage.getItem('mr.sound') !== 'off'; } catch {}
  const buffers = new Map();
  let master = null;

  function wake() {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, len, type, gain, slide) {
    if (!on || !ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), ctx.currentTime + len);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain || 0.09, ctx.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + len);
    o.connect(g).connect(master);
    o.start();
    o.stop(ctx.currentTime + len + 0.02);
  }

  function noise(len, gain, hp) {
    if (!on || !ctx) return;
    const n = Math.floor(ctx.sampleRate * len);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
    const g = ctx.createGain(); g.gain.value = gain || 0.08;
    src.connect(f).connect(g).connect(master);
    src.start();
  }

  /* The cues. Each is a function so a loaded file can replace it. */
  const cues = {
    ui: () => tone(660, 0.06, 'sine', 0.05),
    join: () => { tone(520, 0.08, 'triangle', 0.06); setTimeout(() => tone(780, 0.1, 'triangle', 0.05), 70); },
    count: () => tone(880, 0.09, 'square', 0.06),
    go: () => { tone(300, 0.2, 'sawtooth', 0.09, 600); noise(0.25, 0.06, 400); setTimeout(() => tone(900, 0.3, 'square', 0.05), 80); },
    hit: () => noise(0.05, 0.04, 2000),
    boost: () => tone(420, 0.18, 'sawtooth', 0.05, 1400),
    finish: () => [0, 120, 240].forEach((d, i) => setTimeout(() => tone([523, 659, 784][i], 0.3, 'triangle', 0.07), d)),
    win: () => [0, 130, 260, 430, 600].forEach((d, i) => setTimeout(() => tone([523, 659, 784, 1046, 1318][i], 0.35, 'triangle', 0.08), d)),
    wallet: () => { tone(440, 0.1, 'sine', 0.05); setTimeout(() => tone(660, 0.14, 'sine', 0.05), 90); },
    error: () => tone(200, 0.25, 'square', 0.05, 120)
  };

  let lastHit = 0;
  function play(name) {
    if (!on || !ctx) return;
    if (name === 'hit') { const t = performance.now(); if (t - lastHit < 60) return; lastHit = t; }
    const buf = buffers.get(name);
    if (buf) {
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(master); src.start();
      return;
    }
    if (cues[name]) cues[name]();
  }

  /** Loads a real sound for a cue. Until it arrives, the synth stands in. */
  async function load(name, url) {
    wake();
    if (!ctx) return;
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    buffers.set(name, await ctx.decodeAudioData(arr));
  }

  window.SOUND = {
    wake, play, load,
    get on() { return on; },
    toggle() {
      on = !on;
      try { localStorage.setItem('mr.sound', on ? 'on' : 'off'); } catch {}
      if (on) { wake(); play('ui'); }
      return on;
    }
  };
})();
