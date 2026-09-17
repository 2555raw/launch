/* The live water.
 *
 * The dam, the canyon and the sky are drawn once as SVG. The water is painted
 * every frame on a canvas laid over them: sheets accelerating down the hydropad,
 * the boil where they land, spray climbing out of it, a rainbow in that spray,
 * and the swell on the reservoir held above the crest.
 *
 * Coordinates are fractions of the artwork's 1600x900 box, so every landmark
 * keeps its place at any width.
 */

const Scene = {
  canvas: null, ctx: null, dpr: 1, w: 0, h: 0, frame: 0, running: false,
  streaks: [], boil: [], spray: [],

  /* Landmarks, read off the artwork. */
  LIP: { left: 0.4350, right: 0.5650, y: 0.4700 },    // the overflow bay in the crest
  FOOT: { left: 0.4150, right: 0.5850, y: 0.8600 },   // where the sheet lands
  POOL: { y: 0.8850 },
  RESERVOIR: { top: 0.3350, bottom: 0.4700, left: 0.0550, right: 0.9450 },

  mount(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resize();
    window.addEventListener("resize", () => this.resize(), { passive: true });
    document.addEventListener("visibilitychange", () => document.hidden ? this.stop() : this.start());
    this.seed();
    this.start();
  },

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  art() { const w = this.w; return { w, h: w * (900 / 1600) }; },

  seed() {
    this.streaks = [];
    for (let i = 0; i < 260; i++) this.streaks.push(this.newStreak(Math.random()));
    this.boil = [];
    for (let i = 0; i < 34; i++) this.boil.push(this.newBoil(Math.random()));
    this.spray = [];
    for (let i = 0; i < 40; i++) this.spray.push(this.newSpray(Math.random()));
  },

  newStreak(p = 0) {
    // u is where across the chute it falls; the gates make it slightly banded
    const gate = Math.floor(Math.random() * 7);
    const u = (gate + 0.08 + Math.random() * 0.84) / 7;
    return {
      u,
      p,
      speed: 0.0085 + Math.random() * 0.0115,
      len: 0.06 + Math.random() * 0.22,
      width: 0.6 + Math.random() * 2.6,
      alpha: 0.18 + Math.random() * 0.5,
      wobble: Math.random() * Math.PI * 2,
    };
  },

  newBoil(life = 0) {
    return {
      u: Math.random(),
      life,
      grow: 0.004 + Math.random() * 0.01,
      r: 0.012 + Math.random() * 0.03,
      drift: (Math.random() - 0.45) * 0.0012,
      x: 0,
    };
  },

  newSpray(life = 0) {
    return {
      u: Math.random(),
      life,
      rise: 0.0012 + Math.random() * 0.0026,
      drift: 0.0004 + Math.random() * 0.0016,
      r: 0.02 + Math.random() * 0.05,
      fade: 0.0016 + Math.random() * 0.003,
      y: 0,
      x: 0,
    };
  },

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => { if (!this.running) return; this.draw(); this.frame = requestAnimationFrame(loop); };
    this.frame = requestAnimationFrame(loop);
  },

  stop() { this.running = false; cancelAnimationFrame(this.frame); },

  draw() {
    const { ctx } = this;
    const { w, h } = this.art();
    const t = performance.now() / 1000;
    ctx.clearRect(0, 0, this.w, this.h);

    const veil = parseFloat(document.querySelector(".scene-veil")?.style.opacity || "0");
    if (veil > 0.97) return;
    ctx.globalAlpha = Math.max(0, 1 - veil);

    this.drawReservoir(ctx, w, h, t);
    this.drawFall(ctx, w, h, t);
    this.drawBoil(ctx, w, h);
    this.drawSpray(ctx, w, h);
    this.drawRainbow(ctx, w, h, t);
    ctx.globalAlpha = 1;
  },

  /* Swell on the water held behind the dam. */
  drawReservoir(ctx, w, h, t) {
    const top = this.RESERVOIR.top * h, bottom = this.RESERVOIR.bottom * h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.RESERVOIR.left * w, top, (this.RESERVOIR.right - this.RESERVOIR.left) * w, bottom - top);
    ctx.clip();
    for (let i = 0; i < 26; i++) {
      const y = top + ((i * 37 + t * 5) % (bottom - top));
      const x = this.RESERVOIR.left * w + ((i * 97 + t * 13) % ((this.RESERVOIR.right - this.RESERVOIR.left) * w));
      const a = 0.06 + 0.1 * Math.abs(Math.sin(t * 0.8 + i));
      ctx.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 18 + (i % 5) * 6, y);
      ctx.stroke();
    }
    ctx.restore();
  },

  /* The sheets themselves: each streak accelerates as it falls and spreads out
   * with the chute, so the water fans on its way down. */
  drawFall(ctx, w, h, t) {
    const lipY = this.LIP.y * h, footY = this.FOOT.y * h;
    const drop = footY - lipY;

    ctx.save();
    ctx.lineCap = "round";

    // the lip: a bright rim where the water leaves the gates
    const lipGrad = ctx.createLinearGradient(0, lipY - 4, 0, lipY + 26);
    lipGrad.addColorStop(0, "rgba(255,255,255,.75)");
    lipGrad.addColorStop(1, "rgba(226,243,250,0)");
    ctx.fillStyle = lipGrad;
    ctx.fillRect(this.LIP.left * w, lipY - 4, (this.LIP.right - this.LIP.left) * w, 30);

    for (const s of this.streaks) {
      s.p += s.speed * (0.45 + s.p * 1.5);              // gravity
      if (s.p > 1.05) Object.assign(s, this.newStreak(0));

      const xTop = (this.LIP.left + (this.LIP.right - this.LIP.left) * s.u) * w;
      const xBot = (this.FOOT.left + (this.FOOT.right - this.FOOT.left) * s.u) * w;
      const p0 = Math.max(0, s.p - s.len);
      const p1 = Math.min(1, s.p);
      const wob = Math.sin(t * 2.2 + s.wobble) * 2.2;

      const x0 = xTop + (xBot - xTop) * p0 + wob;
      const x1 = xTop + (xBot - xTop) * p1 + wob;
      const y0 = lipY + drop * p0;
      const y1 = lipY + drop * p1;

      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      const a = s.alpha * (0.35 + 0.65 * (1 - Math.abs(s.u - 0.5) * 1.1));
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.35, `rgba(248,253,255,${(a * 0.75).toFixed(3)})`);
      g.addColorStop(1, `rgba(255,255,255,${a.toFixed(3)})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = s.width * (0.7 + p1 * 0.8);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + wob * 0.6, (y0 + y1) / 2, x1, y1);
      ctx.stroke();
    }

    // the body of the fall, a soft veil the streaks ride on
    const body = ctx.createLinearGradient(0, lipY, 0, footY);
    body.addColorStop(0, "rgba(233,247,252,.42)");
    body.addColorStop(0.55, "rgba(226,242,250,.3)");
    body.addColorStop(1, "rgba(255,255,255,.5)");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(this.LIP.left * w, lipY);
    ctx.lineTo(this.LIP.right * w, lipY);
    ctx.lineTo(this.FOOT.right * w, footY);
    ctx.lineTo(this.FOOT.left * w, footY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  /* Where it lands: white water turning over itself. */
  drawBoil(ctx, w, h) {
    const y = this.POOL.y * h;
    /* The white water is as wide as what lands in it, not as wide as the frame. */
    const chute = (this.FOOT.right - this.FOOT.left) * w;
    for (const b of this.boil) {
      b.life += b.grow;
      b.u += b.drift;
      if (b.life >= 1) Object.assign(b, this.newBoil(0));
      const x = (this.FOOT.left + (this.FOOT.right - this.FOOT.left) * b.u) * w;
      const r = b.r * chute * 3.1 * (0.4 + b.life * 1.3);
      const a = Math.sin(b.life * Math.PI) * 0.55;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
      g.addColorStop(0.6, `rgba(243,250,253,${(a * 0.5).toFixed(3)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y + (Math.random() - 0.5) * 2, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /* Spray climbing out of the boil and drifting downstream. */
  drawSpray(ctx, w, h) {
    const baseY = this.POOL.y * h;
    const chute = (this.FOOT.right - this.FOOT.left) * w;
    for (const s of this.spray) {
      s.life += s.fade;
      s.y -= s.rise;
      s.x += s.drift;
      if (s.life >= 1) Object.assign(s, this.newSpray(0));
      const x = (this.FOOT.left + (this.FOOT.right - this.FOOT.left) * s.u) * w + s.x * chute * 2.4;
      const y = baseY + s.y * h;
      const r = s.r * chute * 2.2 * (0.5 + s.life * 1.8);
      const a = Math.sin(s.life * Math.PI) * 0.3;
      if (a < 0.004) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /* A rainbow stands in the spray when the light is right, and fades when it is not. */
  drawRainbow(ctx, w, h, t) {
    const strength = 0.34 + 0.3 * Math.sin(t * 0.13);
    if (strength <= 0.05) return;
    const cx = (this.FOOT.right + 0.055) * w;
    const cy = this.POOL.y * h + 0.04 * h;
    const r = 0.115 * w;
    const bands = [
      ["255,120,110", 1.0], ["255,178,96", 0.92], ["250,226,120", 0.86],
      ["150,220,150", 0.8], ["130,196,240", 0.76], ["170,150,230", 0.72],
    ];
    ctx.save();
    ctx.lineCap = "butt";
    bands.forEach(([rgb, k], i) => {
      ctx.strokeStyle = `rgba(${rgb},${(strength * 0.22 * k).toFixed(3)})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, r - i * 5, Math.PI * 1.06, Math.PI * 1.62);
      ctx.stroke();
    });
    ctx.restore();
  },
};
