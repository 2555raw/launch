// Landing page: the hash ticker in the hero and the live cloak demo.
import { commit, randomBytes, toHex, SALT_BYTES, KEY_BYTES } from "./obscura.js";

// Hero ticker: a real SHA-256 of fresh random bytes, every couple of seconds.
const ticker = document.getElementById("ticker");
async function tick() {
  const digest = await crypto.subtle.digest("SHA-256", randomBytes(64));
  ticker.textContent = "0x" + toHex(new Uint8Array(digest));
}
if (ticker) {
  tick();
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(tick, 2400);
}

// Demo: same maths as the console, recomputed on every keystroke.
const $ = (id) => document.getElementById(id);
const fields = ["d-amount", "d-symbol", "d-chain"].map($);
let salt = randomBytes(SALT_BYTES);
let key = randomBytes(KEY_BYTES);

async function render() {
  $("d-salt").textContent = "0x" + toHex(salt);
  $("d-key").textContent = "0x" + toHex(key);
  try {
    const asset = { amount: $("d-amount").value, symbol: $("d-symbol").value, chain: $("d-chain").value };
    $("d-commit").textContent = "0x" + (await commit(asset, salt, key));
  } catch (e) {
    $("d-commit").textContent = e.message;
  }
}

if ($("demo")) {
  fields.forEach((f) => f.addEventListener("input", render));
  $("d-reroll").addEventListener("click", () => {
    salt = randomBytes(SALT_BYTES);
    key = randomBytes(KEY_BYTES);
    render();
  });
  render();
}
