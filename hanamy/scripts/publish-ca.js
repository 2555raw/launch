#!/usr/bin/env node
/* One command for the moment the address arrives.
 *
 * Validate, write, rebuild, stage and push. Doing this as five commands by
 * hand is five chances to publish a half-updated site, and this is the one
 * string where being wrong costs somebody money.
 *
 *   npm run ca:publish -- 0x...        set it and push
 *   npm run ca:publish -- 0x... --dry  do everything but commit
 *   npm run ca:publish -- --clear      put it back to pending and push
 */
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { parse } = require("./address");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const raw = args.find((a) => !a.startsWith("--"));
const clear = args.includes("--clear") || !raw;

const run = (cmd, a, opts = {}) =>
  execFileSync(cmd, a, { cwd: ROOT, stdio: "inherit", ...opts });

let addr = "";
if (!clear) {
  try { addr = parse(raw); }
  catch (e) { console.error("refused: " + e.message); process.exit(1); }
}

console.log(clear ? "clearing the address" : "publishing " + addr);
run("node", ["scripts/set-ca.js", clear ? "--clear" : addr]);
run("python3", ["build.py"]);
run("node", ["scripts/stage-artifact.js"]);

// the page must actually carry it before any of this is pushed
const page = fs.readFileSync(path.join(ROOT, "ca.js"), "utf8");
if (!clear && !page.includes(addr)) {
  console.error("stopped: ca.js does not contain the address after writing it.");
  process.exit(1);
}

if (dry) { console.log("dry run: nothing committed"); process.exit(0); }

run("git", ["add", "-A", "."], { cwd: ROOT });
const msg = clear
  ? "hanamy: clear the contract address\n\nThe pill goes back to pending."
  : `hanamy: publish the contract address\n\n${addr}\n\nChecksummed before writing, and ca.js is served no-cache so it reaches\nvisitors the minute it changes.`;
try {
  run("git", ["commit", "-q", "-m", msg + "\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>"]);
} catch (e) {
  console.log("nothing to commit");
}
run("git", ["push", "-u", "origin", "HEAD"]);
console.log("\npushed. Railway redeploys on its own; republish the artifact to match.");
