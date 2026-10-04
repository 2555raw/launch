// Landing page: the live receipt in the hero, the film player, and the cloak demo.
import { commit, randomBytes, toHex, SALT_BYTES, KEY_BYTES } from "./obscura.js";
import { termsAccepted } from "./terms.js";

const $ = (id) => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- hero receipt: a real commitment, re-sealed every few seconds ----------
const heroAssets = [
  { amount: "2.5", symbol: "ETH", chain: "ethereum" },
  { amount: "40000", symbol: "USDC", chain: "base" },
  { amount: "0.8", symbol: "WBTC", chain: "arbitrum" },
];
let heroIndex = 0;
async function sealHero() {
  const a = heroAssets[heroIndex++ % heroAssets.length];
  const hash = await commit(a, randomBytes(SALT_BYTES), randomBytes(KEY_BYTES));
  $("r-asset").textContent = `${Number(a.amount).toLocaleString("en-US")} ${a.symbol}`;
  $("r-chain").textContent = a.chain;
  const out = $("r-hash");
  if (reduced) { out.textContent = "0x" + hash; return; }
  // type the new hash in over the old one
  let i = 0;
  const step = () => {
    i = Math.min(64, i + 4);
    out.textContent = "0x" + hash.slice(0, i) + (i < 64 ? toHex(randomBytes(1))[0] : "");
    if (i < 64) requestAnimationFrame(step);
  };
  step();
}
if ($("r-hash")) {
  sealHero();
  if (!reduced) setInterval(sealHero, 4200);
}

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
let salt = randomBytes(SALT_BYTES);
let key = randomBytes(KEY_BYTES);

async function renderDemo() {
  $("d-salt").textContent = "0x" + toHex(salt);
  $("d-key").textContent = "0x" + toHex(key);
  const amount = $("d-amount");
  try {
    const asset = { amount: amount.value, symbol: $("d-symbol").value, chain: $("d-chain").value };
    $("d-commit").textContent = "0x" + (await commit(asset, salt, key));
    amount.removeAttribute("aria-invalid");
  } catch (e) {
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
