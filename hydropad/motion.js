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

  /* Build the descent on the front page, take it away everywhere else. */
  syncScene(page) {
    if (page !== "markets" || typeof WORLD === "undefined") { this.teardown(); return; }
    if (!document.querySelector(".world")) {
      const el = document.createElement("div");
      el.className = "world";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = `<img class="world-img" src="${WORLD.blur}" alt="" decoding="async">
        <div class="world-scrim"></div>`;
      document.body.prepend(el);

      /* The blurred frame is 11 KB and shows at once; the full one is two
       * megabytes and takes its place when it has decoded, so nothing is ever
       * blank and nothing ever pops. */
      const img = el.querySelector(".world-img");
      const full = new Image();
      full.decoding = "async";
      full.src = window.matchMedia("(max-width: 760px)").matches ? WORLD.low : WORLD.src;
      full.addEventListener("load", () => { img.src = full.src; img.classList.add("sharp"); });
    }
    this.worldImg = document.querySelector(".world-img");
    this.worldScrim = document.querySelector(".world-scrim");
    document.body.classList.add("has-world");
    this.onScroll();
  },

  teardown() {
    const el = document.querySelector(".world");
    if (el) el.remove();
    this.worldImg = this.worldScrim = null;
    document.body.classList.remove("has-world");
  },

  onScroll() {
    const y = window.scrollY || 0;
    document.body.classList.toggle("scrolled", y > 24);
    if (!this.worldImg) return;

    /* One frame, descended: the top of the page is the top of the photograph
     * and the bottom of the page is the bottom of the landscape that continues
     * from it. Every scroll position is a position in the same picture. */
    const doc = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const p = Math.min(1, Math.max(0, y / doc));
    const frameH = this.worldImg.getBoundingClientRect().height || 1;
    const travel = Math.max(0, frameH - window.innerHeight);
    this.worldImg.style.transform = `translate3d(-50%, ${(-p * travel).toFixed(1)}px, 0)`;

    /* It gets darker on the way down the valley, which keeps type readable and
     * makes the descent read as one movement. */
    /* Nothing over the photograph while it is the photograph; the shade comes
       in as the page goes down into the valley. */
    if (this.worldScrim) {
      const shade = Math.max(0, (p - 0.06) / 0.94) * 0.55;
      this.worldScrim.style.opacity = shade.toFixed(3);
    }
    this.progress = p;
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
