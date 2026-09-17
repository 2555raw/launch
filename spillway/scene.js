/* The live part of the backdrop.
 *
 * The scene's hills, dam and lake are drawn once as SVG; what moves goes here:
 * sunlight breaking on the water, the swell crossing it, and the mist thrown up
 * where the discharge hits the river. It paints on a canvas sized to the same
 * layout box as the scene layers, so everything lines up with the artwork
 * whatever the viewport.
 */

const Scene = {
  canvas: null,
  ctx: null,
  dpr: 1,
  w: 0,
  h: 0,
  frame: 0,
  running: false,
  glints: [],
  motes: [],

  /* Landmarks, in fractions of the artwork's 1600x900 box, so they track it. */
  LAKE: { top: 0.40, bottom: 0.72, left: 0.02, right: 0.99 },
  TOE: { x: 0.155, y: 0.955 },

  mount(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.resize();
    window.addEventListener("resize", () => this.resize(), { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stop(); else this.start();
    });
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

  /* The artwork is drawn at 100% width from the top, so its box is the page
   * width by that width times 900/1600. */
  art() {
    const w = this.w;
    const h = w * (900 / 1600);
    return { w, h };
  },

  seed() {
    this.glints = [];
    for (let i = 0; i < 90; i++) {
      this.glints.push({
        x: Math.random(),
        y: Math.random(),
        len: 0.02 + Math.random() * 0.08,
        speed: 0.004 + Math.random() * 0.012,
        phase: Math.random() * Math.PI * 2,
        weight: 0.5 + Math.random() * 1.6,
      });
    }
    this.motes = [];
    for (let i = 0; i < 26; i++) this.motes.push(this.newMote(Math.random()));
  },

  newMote(life = 0) {
    return {
      x: (Math.random() - 0.5) * 0.06,
      y: (Math.random() - 0.5) * 0.012,
      r: 0.012 + Math.random() * 0.03,
      rise: 0.00035 + Math.random() * 0.0007,
      drift: (Math.random() - 0.3) * 0.0006,
      life,
      fade: 0.0015 + Math.random() * 0.0025,
    };
  },

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.draw();
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  },

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
  },

  draw() {
    const { ctx } = this;
    const { w, h } = this.art();
    const t = performance.now() / 1000;
    ctx.clearRect(0, 0, this.w, this.h);

    // nothing to paint once the veil has closed over the scene
    const veil = parseFloat(document.querySelector(".scene-veil")?.style.opacity || "0");
    if (veil > 0.97) return;
    ctx.globalAlpha = Math.max(0, 1 - veil);

    this.drawWater(ctx, w, h, t);
    this.drawMist(ctx, w, h);
    ctx.globalAlpha = 1;
  },

  /* Sunlight breaking on the swell: short horizontal strokes that drift with the
   * surface and flare as they pass under the sun, which sits to the right. */
  drawWater(ctx, w, h, t) {
    const top = h * this.LAKE.top, bottom = h * this.LAKE.bottom;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, w, bottom - top);
    ctx.clip();
    ctx.lineCap = "round";

    for (const g of this.glints) {
      g.x += g.speed * 0.0016;
      if (g.x > 1.08) g.x -= 1.16;

      const y = top + g.y * (bottom - top);
      const depth = g.y;                                   // 0 far shore, 1 near
      const swell = Math.sin(t * 0.7 + g.phase + g.y * 9) * (2 + depth * 5);
      const x = g.x * w;
      const len = g.len * w * (0.45 + depth);
      const sun = Math.max(0, 1 - Math.abs(x / w - 0.72) * 1.7);   // the sun's track
      const flare = 0.1 + 0.9 * Math.pow(Math.max(0, Math.sin(t * 0.9 + g.phase)), 2);
      const alpha = (0.05 + 0.5 * sun) * flare * (0.35 + depth * 0.65);
      if (alpha < 0.012) continue;

      ctx.strokeStyle = `rgba(255, 252, 240, ${alpha.toFixed(3)})`;
      ctx.lineWidth = g.weight * (0.6 + depth);
      ctx.beginPath();
      ctx.moveTo(x - len / 2, y + swell);
      ctx.quadraticCurveTo(x, y + swell - 1.5, x + len / 2, y + swell);
      ctx.stroke();
    }

    // the swell itself: broad bands of shade crossing the lake
    for (let i = 0; i < 3; i++) {
      const phase = t * (0.05 + i * 0.015) + i * 2.1;
      const y = top + ((phase % 1) * 1.2 - 0.1) * (bottom - top);
      const band = ctx.createLinearGradient(0, y - 26, 0, y + 26);
      band.addColorStop(0, "rgba(16, 48, 74, 0)");
      band.addColorStop(0.5, `rgba(16, 48, 74, ${0.05 + i * 0.012})`);
      band.addColorStop(1, "rgba(16, 48, 74, 0)");
      ctx.fillStyle = band;
      ctx.fillRect(0, y - 26, w, 52);
    }
    ctx.restore();
  },

  /* Mist off the discharge: it climbs, spreads and thins out. */
  drawMist(ctx, w, h) {
    const ox = this.TOE.x * w, oy = this.TOE.y * h;
    for (const m of this.motes) {
      m.life += m.fade;
      m.y -= m.rise;
      m.x += m.drift;
      if (m.life >= 1) Object.assign(m, this.newMote(0));

      const x = ox + m.x * w;
      const y = oy + m.y * h;
      const r = m.r * w * (0.5 + m.life * 1.6);
      const alpha = Math.sin(m.life * Math.PI) * 0.3;
      if (alpha <= 0.002) continue;

      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255, 255, 255, ${alpha.toFixed(3)})`);
      g.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};
