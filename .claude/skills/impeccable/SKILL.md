---
name: impeccable
description: Quality pass over a static site in this repo (default bonded-site/). Parses every script, checks that every id the scripts reach exists in the pages, that every local link lands on a file, that the nav reaches every page, that the asset version query is the same everywhere, then drives every page in Chromium at desktop and phone width (no page errors, no horizontal scroll) and runs the launch → pair → trade → playground loop. Fix what it finds, re-run until clean, report the result. Use when asked for /impeccable, a quality pass, or before a deploy.
---

# impeccable

A pass that finds what is broken before a visitor does. Nothing here is a style opinion;
every check is a fact about the site.

## Run it

```bash
node .claude/skills/impeccable/check.mjs [folder]     # folder defaults to bonded-site
```

The browser checks need Playwright and the Chromium at `/opt/pw-browsers/chromium`
(or `PLAYWRIGHT_CHROMIUM` pointing at one). If `playwright` is not resolvable from the
repo, install it into a scratch folder and point `PLAYWRIGHT_DIR` at its `node_modules`:

```bash
d=$(mktemp -d) && (cd "$d" && npm init -y >/dev/null && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright >/dev/null)
PLAYWRIGHT_DIR="$d/node_modules" node .claude/skills/impeccable/check.mjs
```

The script starts its own static server on a free port, so nothing needs to be running.

## What it checks

1. **Every script parses** (`node --check`), including `server.js`.
2. **Every id the script reaches exists.** Ids used in `$('#x')`, `getElementById('x')`,
   `data-scroll="x"` and `href="#x"` must exist in at least one page that loads that script,
   and page-scoped ones (inside an `if (page === '…')` block) in that page.
3. **Every local link lands.** `href`/`src` that is not `http`, `#`, `mailto:` or `data:`
   must be a file in the folder (query strings stripped).
4. **The nav reaches every page.** Each `*.html` is linked from the shared nav or footer.
5. **One asset version.** Every page loads `styles.css?v=N` and `app.js?v=N` with the same N.
6. **Server sanity.** `/health` answers `ok`, `/board` answers without the extension, a path
   that climbs out of the folder is refused.
7. **Every page, two widths.** 1440 and 390: no `pageerror`, no console errors other than
   font loads, `scrollWidth <= clientWidth`, and the page's main container is present.
8. **The loop.** Launch a pair on TSLA with a first buy, land on its pair page with the
   position shown, buy, sell half, see one launched pair and one position in the playground,
   find it on the board and in the live feed.

## When it fails

Fix the cause, not the check. A missing id means the page and the script disagree; a
horizontal scroll means a fixed width somewhere; a console error is a bug. Re-run until the
last line reads `impeccable: clean`. Then say what was found and what changed.

## Report

One short list: what failed and how it was fixed, or `clean` with the counts (pages, ids,
links, flows). No screenshots unless something visual changed.
