// Landing page: the live receipt in the hero, the film player, and the cloak demo.
import { commit, randomBytes, toHex, SALT_BYTES, KEY_BYTES } from "./obscura.js";
import { termsAccepted } from "./terms.js";
import { rpc } from "./proof.js";

const $ = (id) => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- hero field: dots ripple out of the mark ----------
// A grid of square dots whose size follows rings around the mark. The rings
// carry a faint eight-point star, the mark's own shape, and every seal sends
// one brighter ring outward. Drawn at 30 fps, only while the hero is on screen.
const field = (() => {
  const canvas = document.querySelector(".hero-field");
  const hero = document.querySelector(".hero");
  if (!canvas || !hero) return null;
  const ctx = canvas.getContext("2d");
  const GAP = 9;
  let w = 0, h = 0, dpr = 1, cx = 0, cy = 0, fadeFrom = 0, fadeSpan = 1, quiet = 1, pulseAt = -1e9, running = false, visible = true, last = 0;
  const t0 = performance.now();
  function resize() {
    const r = hero.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const narrow = w < 900;
    // On phones the text fills the width: the rings start from the top corner, quieter.
    cx = narrow ? w : w * 0.625; cy = narrow ? 40 : h * 0.53;
    fadeFrom = narrow ? -1 : w * 0.1; fadeSpan = w * 0.36; quiet = narrow ? 0.4 : 1;
    hero.style.setProperty("--mx", cx + "px"); hero.style.setProperty("--my", cy + "px");
    draw(performance.now());
  }
  function draw(now) {
    const t = (now - t0) / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const reach = Math.max(w, h) * 0.62;
    const ring = (now - pulseAt) / 1000 * 420; // the seal's ring, in px from the centre
    const buckets = [[], [], [], [], [], []];
    const blue = [];
    for (let y = GAP / 2; y < h; y += GAP) {
      for (let x = GAP / 2; x < w; x += GAP) {
        const dx = x - cx, dy = y - cy;
        const r = Math.hypot(dx, dy);
        if (r < 52) continue; // leave room for the mark
        const a = Math.atan2(dy, dx);
        const rr = r * (1 + 0.05 * Math.cos(8 * a));
        const wave = 0.5 + 0.5 * Math.sin(rr / 10 - t * 1.4);
        const fall = Math.max(0, 1 - r / reach);
        // quieter behind the headline, so the words stay crisp
        const fade = fadeFrom < 0 ? 1 : Math.min(1, Math.max(0.12, (x - fadeFrom) / fadeSpan));
        let v = wave * wave * fall * fade * quiet;
        const near = ring - r;
        const glow = near > -40 && near < 40 ? Math.exp(-(near * near) / 500) : 0;
        if (glow * fall * fade > 0.12) { blue.push(x, y, 1.2 + 2.2 * glow); continue; }
        if (v < 0.04) continue;
        const k = Math.min(5, Math.floor(v * 6));
        buckets[k].push(x, y, 0.8 + 2.4 * v);
      }
    }
    buckets.forEach((list, k) => {
      if (!list.length) return;
      ctx.fillStyle = `rgba(214, 222, 236, ${0.12 + k * 0.13})`;
      ctx.beginPath();
      for (let i = 0; i < list.length; i += 3) { const s = list[i + 2]; ctx.rect(list[i] - s / 2, list[i + 1] - s / 2, s, s); }
      ctx.fill();
    });
    if (blue.length) {
      ctx.fillStyle = "rgba(122, 162, 255, .9)";
      ctx.beginPath();
      for (let i = 0; i < blue.length; i += 3) { const s = blue[i + 2]; ctx.rect(blue[i] - s / 2, blue[i + 1] - s / 2, s, s); }
      ctx.fill();
    }
  }
  function loop(now) {
    if (!running) return;
    if (now - last > 33) { last = now; draw(now); }
    requestAnimationFrame(loop);
  }
  function start() { if (!running && visible && !document.hidden && !reduced) { running = true; requestAnimationFrame(loop); } }
  function stop() { running = false; }
  new ResizeObserver(resize).observe(hero);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(hero);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  resize(); start();
  return { pulse() { pulseAt = performance.now(); if (reduced) draw(pulseAt); } };
})();

// The bar sits on the night while the hero fills the top of the screen.
const heroEl = document.querySelector(".hero");
if (heroEl) {
  const onHero = () => document.documentElement.classList.toggle("on-hero", scrollY < heroEl.offsetHeight - 80);
  addEventListener("scroll", onHero, { passive: true });
  onHero();
}

// ---------- live block: the latest Ethereum block, read from a public node ----------
const blockEl = $("h-block");
if (blockEl) {
  let lastBlock = 0, seenAt = 0;
  const tick = async () => {
    if (document.hidden) return;
    try {
      const n = Number(await rpc(1, "eth_blockNumber", []));
      if (n !== lastBlock) {
        lastBlock = n; seenAt = Date.now();
        scramble(blockEl, "#" + n.toLocaleString("en-US"), 500);
        const live = document.querySelector(".hcard-live");
        live?.classList.remove("tick"); void live?.offsetWidth; live?.classList.add("tick");
      }
    } catch { if (!lastBlock) $("h-block-sub").textContent = "The public node did not answer"; }
  };
  const ago = () => { if (lastBlock) $("h-block-sub").textContent = `Latest block, seen ${Math.round((Date.now() - seenAt) / 1000)} s ago`; };
  tick(); setInterval(tick, 12000); setInterval(ago, 1000);
}

// ---------- hero receipt: a real commitment, re-sealed every few seconds ----------
const heroAssets = [
  { amount: "2.5", symbol: "ETH", chain: "ethereum" },
  { amount: "40000", symbol: "USDC", chain: "base" },
  { amount: "0.8", symbol: "WBTC", chain: "arbitrum" },
];
let heroIndex = 0;

// Resolve a hex string left to right out of noise. Returns when it lands.
const HEX = "0123456789abcdef";
export function scramble(el, target, ms = 900) {
  if (reduced) { el.textContent = target; return Promise.resolve(); }
  const start = performance.now();
  const run = (el._scramble = (el._scramble || 0) + 1); // a newer call wins
  const lead = target.startsWith("0x") ? 2 : 0;
  el.classList.add("scrambling");
  return new Promise((done) => {
    const frame = (now) => {
      if (el._scramble !== run) return done();
      const k = Math.min(1, (now - start) / ms);
      const fixed = Math.max(lead, Math.floor(target.length * (1 - Math.pow(1 - k, 2))));
      let out = target.slice(0, fixed);
      for (let i = fixed; i < target.length; i++) out += HEX[(Math.random() * 16) | 0];
      el.textContent = out;
      if (k < 1) requestAnimationFrame(frame);
      else { el.textContent = target; el.classList.remove("scrambling"); done(); }
    };
    requestAnimationFrame(frame);
  });
}

async function sealHero() {
  const a = heroAssets[heroIndex++ % heroAssets.length];
  const hash = await commit(a, randomBytes(SALT_BYTES), randomBytes(KEY_BYTES));
  const card = document.querySelector(".receipt");
  document.querySelector(".hero")?.style.setProperty("--turn", `${heroIndex * 180}deg`);
  $("r-asset").textContent = `${Number(a.amount).toLocaleString("en-US")} ${a.symbol}`;
  $("r-chain").textContent = a.chain;
  card.classList.remove("sealed");
  card.classList.add("sealing");
  $("r-seal-text").textContent = "Sealing…";
  await scramble($("r-hash"), "0x" + hash, 1000);
  card.classList.remove("sealing");
  field?.pulse();
  void card.offsetWidth; // restart the glint
  card.classList.add("sealed");
  $("r-seal-text").textContent = "Sealed locally";
}
if ($("r-hash")) {
  // First seal lands once the card has arrived; then a new asset every few seconds.
  setTimeout(() => {
    sealHero();
    if (!reduced) setInterval(() => { if (!document.hidden) sealHero(); }, 4800);
  }, reduced ? 0 : 1300);
}

// ---------- things that start when they come into view ----------
function onceInView(el, cls, threshold = 0.35) {
  if (!el) return;
  if (!("IntersectionObserver" in window)) return el.classList.add(cls);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { el.classList.add(cls); io.disconnect(); }
  }, { threshold });
  io.observe(el);
}
onceInView($("wallet-row"), "in", 0.4);
onceInView($("explorer"), "scan", 0.5);
onceInView($("band"), "in", 0.3);

// ---------- films: chapter list drives one player ----------
// The same captions the films burn in, shown as text under the player on small screens.
const CUES = {
  cloak: [[0, "Cloak a bond: one hash that only your receipt can open."], [2.6, "Start with an asset, a random salt and a one-time key."], [5.4, "SHA-256 runs over all three. Inside your browser."], [8.4, "Out comes one 32-byte hash. It names nothing."], [11.4, "The chain can store the hash. Only your receipt can open it."]],
  transfer: [[0, "Hand a bond on: sealed for one recipient, re-cloaked on arrival."], [2.6, "Seal the receipt with AES-256-GCM, behind a passphrase."], [5.6, "Send the package one way. Send the passphrase another."], [8.6, "The recipient opens it and re-cloaks under fresh keys."], [11.6, "One commitment out, one in. Nothing on the chain links them."]],
  prove: [[0, "Prove one thing: show the point, hide the rest."], [2.6, "Your wallet holds many things. Most are nobody's business."], [5.6, "Hand one receipt to one counterparty."], [8.6, "Their browser recomputes the hash and compares."], [11.6, "They learn one bit: true. Everything else stays hidden."]],
};
const player = $("film");
const chapters = [...document.querySelectorAll(".chapter")];
let chapterIndex = 0;
// H.264 where the browser has it, VP9 WebM otherwise (open-source Chromium builds).
const ext = player && !player.canPlayType('video/mp4; codecs="avc1.640028"') && player.canPlayType('video/webm; codecs="vp9"') ? ".webm" : ".mp4";

function load(i, play = true) {
  chapterIndex = (i + chapters.length) % chapters.length;
  const c = chapters[chapterIndex];
  chapters.forEach((el) => {
    el.setAttribute("aria-current", String(el === c));
    el.querySelector(".chapter-progress i").style.transform = "scaleX(0)";
  });
  player.classList.add("switching");
  player.poster = c.dataset.poster;
  player.src = c.dataset.src.replace(/\.mp4$/, ext);
  player.setAttribute("aria-label", `Film ${chapterIndex + 1} of ${chapters.length}: ${c.querySelector("h3").textContent}`);
  if (play) player.play().catch(() => {});
}

if (player && chapters.length) {
  chapters.forEach((c, i) => c.addEventListener("click", () => load(i)));
  const caption = $("film-caption");
  player.addEventListener("timeupdate", () => {
    const cues = CUES[chapters[chapterIndex].dataset.src.match(/(\w+)\.mp4$/)[1]] || [];
    const cue = cues.filter(([t]) => t <= player.currentTime).pop();
    if (caption && cue && caption.textContent !== cue[1]) caption.textContent = cue[1];
    const bar = chapters[chapterIndex].querySelector(".chapter-progress i");
    bar.style.transform = `scaleX(${player.duration ? player.currentTime / player.duration : 0})`;
  });
  player.addEventListener("loadeddata", () => player.classList.remove("switching"));
  player.addEventListener("ended", () => load(chapterIndex + 1, chapterIndex + 1 < chapters.length));

  const toggle = $("film-toggle");
  const syncToggle = () => {
    toggle.setAttribute("aria-label", player.paused ? "Play film" : "Pause film");
    toggle.querySelector(".i-play").style.display = player.paused ? "" : "none";
    toggle.querySelector(".i-pause").style.display = player.paused ? "none" : "";
  };
  toggle.addEventListener("click", () => (player.paused ? player.play().catch(() => {}) : player.pause()));
  player.addEventListener("play", syncToggle);
  player.addEventListener("pause", syncToggle);
  $("film-restart").addEventListener("click", () => load(0));
  load(0, false);
  syncToggle();

  // Start playing the first time the films scroll into view, once the terms are accepted.
  let started = false;
  const start = () => {
    if (started || reduced) return;
    started = true;
    player.play().catch(() => {});
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && document.documentElement.classList.contains("gated") === false) start();
      if (!e.isIntersecting && !player.paused) player.pause();
    }
  }, { threshold: 0.45 });
  io.observe(player);
  if (!termsAccepted) document.addEventListener("terms:accepted", () => { io.unobserve(player); io.observe(player); }, { once: true });
}

// ---------- demo: same maths as the console, recomputed on every keystroke ----------
// Screen readers hear one short line, a moment after typing stops.
let announceTimer;
const live = Object.assign(document.createElement("span"), { className: "sr-only" });
live.setAttribute("aria-live", "polite");
document.body.append(live);
function announce(text) {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { live.textContent = ""; live.textContent = text; }, 700);
}
let salt = randomBytes(SALT_BYTES);
let key = randomBytes(KEY_BYTES);

async function renderDemo() {
  $("d-salt").textContent = "0x" + toHex(salt);
  $("d-key").textContent = "0x" + toHex(key);
  const amount = $("d-amount");
  try {
    const asset = { amount: amount.value, symbol: $("d-symbol").value, chain: $("d-chain").value };
    scramble($("d-commit"), "0x" + (await commit(asset, salt, key)), 420);
    announce("Seal code changed");
    amount.removeAttribute("aria-invalid");
  } catch (e) {
    $("d-commit")._scramble = ($("d-commit")._scramble || 0) + 1; // stop a scramble still landing
    $("d-commit").classList.remove("scrambling");
    $("d-commit").textContent = e.message;
    amount.setAttribute("aria-invalid", "true");
  }
}

if ($("demo")) {
  ["d-amount", "d-symbol", "d-chain"].forEach((id) => $(id).addEventListener("input", renderDemo));
  $("d-reroll").addEventListener("click", () => {
    salt = randomBytes(SALT_BYTES);
    key = randomBytes(KEY_BYTES);
    renderDemo();
  });
  renderDemo();
}

// ---------- story: the step in view drives the stage ----------
const stage = $("story-stage");
const steps = [...document.querySelectorAll(".story-step")];
if (stage && steps.length && "IntersectionObserver" in window) {
  const setStep = (n) => {
    if (stage.dataset.step === n) return;
    stage.dataset.step = n;
    const tag = $("st-tag");
    if (tag) tag.textContent = { 1: "Public", 2: "Sealing 1 of 6", 3: "Proof sent", 4: "Rest stays private" }[n];
    steps.forEach((s) => s.classList.toggle("is-active", s.dataset.step === n));
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) setStep(e.target.dataset.step);
  }, { rootMargin: "-45% 0px -50% 0px" });
  steps.forEach((s) => io.observe(s));
}

// ---------- headings rise word by word ----------
// Plain-text headings only; the words stay real text for screen readers.
for (const h of document.querySelectorAll("main h2")) {
  if (h.children.length || h.closest(".closing")) continue;
  const words = h.textContent.trim().split(/\s+/);
  h.replaceChildren(...words.flatMap((w, i) => {
    const outer = document.createElement("span");
    outer.className = "w";
    outer.style.setProperty("--w", i);
    const inner = document.createElement("span");
    inner.textContent = w;
    outer.append(inner);
    return i ? [" ", outer] : [outer];
  }));
  h.classList.add("split-words");
  onceInView(h, "in", 0.6);
}
