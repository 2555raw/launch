#!/usr/bin/env node
/* Writes the contract address into ca.js.
 *
 * It validates and checksums before writing, because a contract address is
 * the one string on the site where a single wrong character sends somebody
 * else's money somewhere it cannot be recovered from.
 */
const fs = require("fs");
const path = require("path");

const arg = (process.argv[2] || "").trim();
const FILE = path.join(__dirname, "..", "ca.js");

if (!arg || arg === "--clear") {
  const s = fs.readFileSync(FILE, "utf8").replace(/window\.SITE_CA = "[^"]*";/,
    'window.SITE_CA = "";');
  fs.writeFileSync(FILE, s);
  console.log("cleared: the site will show CA pending");
  process.exit(0);
}

if (!/^0x[0-9a-fA-F]{40}$/.test(arg)) {
  console.error(`refused: "${arg}" is not a 20 byte address.`);
  console.error("expected 0x followed by 40 hex characters.");
  process.exit(1);
}

/* EIP-55: the capitalisation is a checksum, so a typo in a mixed-case
   address is visible rather than silent. */
const { keccak_256 } = (() => {
  try { return require("js-sha3"); } catch (e) { return {}; }
})();

let out = arg.toLowerCase();
if (keccak_256) {
  const body = out.slice(2);
  const hash = keccak_256(body);
  out = "0x" + [...body].map((c, i) =>
    parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c).join("");
  if (/[A-F]/.test(arg.slice(2)) && /[a-f]/.test(arg.slice(2)) && arg !== out) {
    console.error("refused: that address is mixed case and fails its EIP-55 checksum.");
    console.error("  given:    " + arg);
    console.error("  expected: " + out);
    process.exit(1);
  }
} else {
  console.warn("note: js-sha3 not installed, so the address is stored lower case");
}

const s = fs.readFileSync(FILE, "utf8").replace(/window\.SITE_CA = "[^"]*";/,
  `window.SITE_CA = "${out}";`);
fs.writeFileSync(FILE, s);
console.log("set: " + out);
