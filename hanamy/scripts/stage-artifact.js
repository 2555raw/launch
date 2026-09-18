#!/usr/bin/env node
/* Copies the built site into .artifact/ in the shape the artifact host
 * wants: the page without its document wrapper, everything else as is. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DST = path.join(ROOT, ".artifact");
const FILES = ["styles.css", "talk.css", "art.js", "app.js", "data.js", "ca.js",
               "vanish.js", "talk.js", "models.html", "docs.html", "staking.html",
               "story.html"];

fs.mkdirSync(path.join(DST, "media"), { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(ROOT, f), path.join(DST, f));
for (const f of ["hero-wide.webp", "hero-tall.webp", "grove.webp", "card.jpg"])
  fs.copyFileSync(path.join(ROOT, "media", f), path.join(DST, "media", f));

const s = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const head = s.match(/<title>[\s\S]*?<\/head>/)[0].replace("</head>", "").trim();
const body = s.match(/<body>([\s\S]*)<\/body>/)[1].trim();
fs.writeFileSync(path.join(DST, "index.html"), head + "\n" + body + "\n");
console.log("staged " + (FILES.length + 5) + " files into .artifact/");
