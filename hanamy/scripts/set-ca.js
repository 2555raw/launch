#!/usr/bin/env node
/* Writes the contract address into ca.js, which is the only place it lives. */
const fs = require("fs");
const path = require("path");
const { parse, hasKeccak } = require("./address");

const FILE = path.join(__dirname, "..", "ca.js");
const write = (v) => fs.writeFileSync(FILE,
  fs.readFileSync(FILE, "utf8").replace(/window\.SITE_CA = "[^"]*";/,
    `window.SITE_CA = "${v}";`));

const arg = (process.argv[2] || "").trim();
if (!arg || arg === "--clear") {
  write("");
  console.log("cleared: the site will show CA pending");
  process.exit(0);
}
try {
  const out = parse(arg);
  if (!hasKeccak) console.warn("note: js-sha3 missing, stored lower case");
  write(out);
  console.log("set: " + out);
} catch (e) {
  console.error("refused: " + e.message);
  process.exit(1);
}
