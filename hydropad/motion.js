/* The page's motion.
 *
 * The backdrop is a rendered frame that moves as you scroll, with the live
 * water painted over it and a veil that turns opaque as you leave the top of
 * the page, so the tables below always sit on plain ground.
 */

const Motion = {
  layers: [],
  veil: null,
  reduced: false,

  video: null,

  mount() {
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.syncScene(document.body.dataset.page || window.HYDROPAD_PAGE);

    this.onScroll();
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { this.onScroll(); ticking = false; });
    }, { passive: true });

    this.watchReveals();
    this.watchBars();
  },

  /* Build the scene on the front page, take it away everywhere else. */
  syncScene(page) {
    if (page !== "markets") { this.teardown(); return; }
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
    this.tryVideo();
    document.body.classList.add("has-scene");
    this.onScroll();
  },

  teardown() {
    const scene = document.querySelector(".scene");
    Scene.stop();
    if (this.video) { this.video.pause(); this.video = null; }
    if (scene) scene.remove();
    this.layers = [];
    this.veil = null;
    document.body.classList.remove("has-scene", "scrolled");

  },

  /* A filmed backdrop takes over the moment one is present: drop an encoded
   * loop at media/scene.mp4 and the drawn scene steps aside. Nothing else has
   * to change, and if the file is missing or the browser will not play it, the
   * drawn scene simply stays. */
  tryVideo() {
    const scene = document.querySelector(".scene");
    if (!scene || scene.querySelector(".scene-video")) return;

    const v = document.createElement("video");
    v.className = "scene-video";
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    v.preload = "auto";
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("aria-hidden", "true");
    v.poster = "media/scene-poster.jpg";

    // webm first where it exists: same footage, smaller file
    for (const [file, type] of [["media/scene.webm", "video/webm"], ["media/scene.mp4", "video/mp4"]]) {
      const src = document.createElement("source");
      src.src = file;
      src.type = type;
      v.appendChild(src);
    }

    // a viewer on a metered connection keeps the drawn scene
    const conn = navigator.connection;
    if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ""))) return;

    v.addEventListener("loadeddata", () => {
      scene.classList.add("filmed");
      this.video = v;
      this.layers.push([v, 0.12]);
      Scene.stop();
      v.play().catch(() => {});      // a refused autoplay still leaves the frame
    }, { once: true });
    v.addEventListener("error", () => v.remove(), { once: true });

    scene.prepend(v);
    if (this.reduced) v.removeAttribute("autoplay");
  },

  onScroll() {
    const y = window.scrollY || 0;
    document.body.classList.toggle("scrolled", y > 24);
    if (!this.veil) return;

    /* The first screen belongs to the scene, so the veil only starts closing
     * once the hero is on its way out, and is shut by the time the tables are
     * on screen. */
    const start = window.innerHeight * 0.62;
    const fade = Math.min(1, Math.max(0, (y - start) / (window.innerHeight * 0.34)));
    this.veil.style.opacity = fade.toFixed(3);
    const spent = fade >= 1;
    document.querySelector(".scene").classList.toggle("spent", spent);
    if (spent) { Scene.stop(); if (this.video) this.video.pause(); }
    else { if (!this.reduced) Scene.start(); if (this.video && this.video.paused) this.video.play().catch(() => {}); }
    if (this.reduced) return;
    for (const [el, rate] of this.layers) {
      if (el) el.style.transform = `translate3d(0, ${(-y * rate).toFixed(1)}px, 0)`;
    }
  },

  /* Sections arrive rather than appear, but only once and only below the fold.
   * Whatever sits in a row inside them arrives in order, which reads as one
   * movement instead of a dozen. */
  watchReveals() {
    const targets = document.querySelectorAll(".section, .page-head, .hero-in, .site, .step, .card, .pad");
    if (this.reduced || !("IntersectionObserver" in window)) {
      targets.forEach(t => t.classList.add("in"));
      this.fillBars(document);
      return;
    }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        this.stagger(e.target);
        this.fillBars(e.target);
        io.unobserve(e.target);
      }
    }, { rootMargin: "-40px 0px -10% 0px" });
    targets.forEach(t => { t.classList.add("reveal"); io.observe(t); });
  },

  /* Give each child in a row its place in the queue. */
  stagger(root) {
    const rows = root.querySelectorAll(".cards, .steps, .sites, .pv-boxes, .factbar, .chips, .pads");
    for (const row of rows) {
      [...row.children].forEach((child, i) => child.style.setProperty("--i", String(i)));
    }
  },

  /* A bar that is already at its width cannot animate to it, so every bar is
   * rendered empty and filled a frame later. Most of them arrive with a table
   * that was read from the chain long after the section was revealed, so this
   * watches for them instead of being called from each render. */
  fillBars(root) {
    const bars = root && root.querySelectorAll ? root.querySelectorAll("[data-fill]") : [];
    for (const bar of bars) {
      requestAnimationFrame(() => {
        bar.style.width = bar.dataset.fill;
        delete bar.dataset.fill;
      });
    }
  },

  watchBars() {
    this.fillBars(document);
    if (!("MutationObserver" in window)) return;
    new MutationObserver(records => {
      for (const r of records) {
        for (const node of r.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.dataset && node.dataset.fill) this.fillBars(node.parentNode);
          else this.fillBars(node);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  },

};
