/* The page's motion and its sound.
 *
 * The backdrop is a reservoir drawn in three layers that move at different
 * speeds as you scroll, and a veil over them that turns opaque as you leave the
 * top of the page, so the tables below always sit on a plain ground.
 *
 * The water you hear is not a recording: it is noise shaped by filters in the
 * Web Audio graph, so it costs nothing to load and never repeats. It starts
 * muted and only ever plays after someone asks for it.
 */

const Motion = {
  layers: [],
  veil: null,
  reduced: false,

  mount() {
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.querySelector(".scene")) {
      const scene = document.createElement("div");
      scene.className = "scene";
      scene.setAttribute("aria-hidden", "true");
      scene.innerHTML = `
        <div class="scene-layer far"></div>
        <div class="scene-layer clouds"></div>
        <div class="scene-layer mid"></div>
        <canvas class="scene-live"></canvas>
        <div class="scene-layer near"></div>
        <div class="scene-veil"></div>`;
      document.body.prepend(scene);
    }
    this.layers = [
      [document.querySelector(".scene-layer.far"), 0.08],
      [document.querySelector(".scene-layer.clouds"), 0.05],
      [document.querySelector(".scene-layer.mid"), 0.18],
      [document.querySelector(".scene-live"), 0.18],
      [document.querySelector(".scene-layer.near"), 0.32],
    ];
    this.veil = document.querySelector(".scene-veil");
    if (!this.reduced) Scene.mount(document.querySelector(".scene-live"));

    this.onScroll();
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { this.onScroll(); ticking = false; });
    }, { passive: true });

    this.watchReveals();
  },

  onScroll() {
    const y = window.scrollY || 0;
    const fade = Math.min(1, y / (window.innerHeight * 0.85));
    if (this.veil) this.veil.style.opacity = fade.toFixed(3);
    document.body.classList.toggle("scrolled", y > 24);
    if (this.reduced) return;
    for (const [el, rate] of this.layers) {
      if (el) el.style.transform = `translate3d(0, ${(-y * rate).toFixed(1)}px, 0)`;
    }
  },

  /* Sections arrive rather than appear, but only once and only below the fold. */
  watchReveals() {
    const targets = document.querySelectorAll(".section, .page-head, .hero-in");
    if (this.reduced || !("IntersectionObserver" in window)) {
      targets.forEach(t => t.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      }
    }, { rootMargin: "-40px 0px -10% 0px" });
    targets.forEach(t => { t.classList.add("reveal"); io.observe(t); });
  },
};

/* ---------------- the sound of the spillway ---------------- */

const Water = {
  KEY: "spillway.sound",
  ctx: null,
  master: null,
  playing: false,

  wanted() {
    try { return localStorage.getItem(this.KEY) === "on"; } catch (_) { return false; }
  },

  remember(on) {
    try { localStorage.setItem(this.KEY, on ? "on" : "off"); } catch (_) {}
  },

  /* White noise, split into the low roar of falling water and the hiss of spray,
   * with slow random swells so it never sits still. */
  build() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error("This browser has no Web Audio.");
    const ctx = new Ctx();
    this.ctx = ctx;

    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      // a cheap pink-ish filter: water is weighted to the low end
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.14;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const roar = ctx.createBiquadFilter();
    roar.type = "lowpass";
    roar.frequency.value = 480;
    roar.Q.value = 0.7;
    const roarGain = ctx.createGain();
    roarGain.gain.value = 0.9;

    const spray = ctx.createBiquadFilter();
    spray.type = "bandpass";
    spray.frequency.value = 3200;
    spray.Q.value = 0.5;
    const sprayGain = ctx.createGain();
    sprayGain.gain.value = 0.22;

    const master = ctx.createGain();
    master.gain.value = 0;
    this.master = master;

    source.connect(roar).connect(roarGain).connect(master);
    source.connect(spray).connect(sprayGain).connect(master);
    master.connect(ctx.destination);

    // swells: a slow LFO on the spray, and a slower one opening the roar
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.1;
    lfo.connect(lfoGain).connect(sprayGain.gain);

    const sweep = ctx.createOscillator();
    sweep.frequency.value = 0.031;
    const sweepGain = ctx.createGain();
    sweepGain.gain.value = 160;
    sweep.connect(sweepGain).connect(roar.frequency);

    source.start();
    lfo.start();
    sweep.start();
  },

  async start() {
    if (!this.ctx) this.build();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.5, t + 2.5);
    this.playing = true;
    this.remember(true);
  },

  stop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + 0.6);
    this.playing = false;
    this.remember(false);
  },

  async toggle() {
    if (this.playing) this.stop(); else await this.start();
    return this.playing;
  },
};

function wireSound() {
  const btn = document.getElementById("sound");
  if (!btn) return;
  const paint = () => {
    btn.classList.toggle("on", Water.playing);
    btn.setAttribute("aria-pressed", String(Water.playing));
    btn.title = Water.playing ? "Mute the water" : "Listen to the water";
    btn.innerHTML = Water.playing ? SOUND_ON : SOUND_OFF;
  };
  btn.addEventListener("click", async () => {
    try { await Water.toggle(); } catch (e) { console.warn(e); }
    paint();
  });
  paint();

  /* Somebody who asked for sound before gets it back at the first gesture:
   * browsers will not start audio without one. */
  if (Water.wanted() && !Water.playing) {
    const resume = async () => {
      document.removeEventListener("pointerdown", resume);
      document.removeEventListener("keydown", resume);
      try { await Water.start(); paint(); } catch (_) {}
    };
    document.addEventListener("pointerdown", resume, { once: true });
    document.addEventListener("keydown", resume, { once: true });
  }
}

const SOUND_OFF = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M17 9.5 21 14M21 9.5 17 14"/></svg>`;
const SOUND_ON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/></svg>`;
