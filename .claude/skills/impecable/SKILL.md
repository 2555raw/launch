---
name: impecable
description: Full quality pass on MarbleRush (marble-royale). Runs the engine tests, checks every script parses, rebuilds the one-file preview, drives the site in a real browser through lobby, race and results, reviews the screens as a designer, fixes what it finds, then commits and pushes so Railway deploys.
---

# /impecable

A full pass that leaves the site flawless: nothing broken, nothing ugly,
nothing unverified. Work from `marble-royale/`. Do every step; report what
each step found and what was fixed. Never skip a failing check and never
disable a test to get green.

## 1. Static checks

- `node test/engine.test.js` must print all checks passed.
- Every script must parse:
  `for f in server.js lib/*.js public/js/*.js public/js/**/*.js public/shared/*.js public/render.js; do node -e "new (require('vm').Script)(require('fs').readFileSync('$f','utf8'))" || echo "BROKEN $f"; done`
- `node preview/build-app.js` must write `preview/dist/marble-royale.html`.
- `grep -n "TODO\|FIXME\|console.log(" public/js/*.js public/js/**/*.js` and remove leftovers that are not deliberate.
- The HTML must reference only ids and classes that exist: for each `$('#x')` in `public/js/app.js`, check `id="x"` exists in `public/index.html`.

## 2. Browser pass

Start a demo server on a spare port with short rounds:
`DEMO_MODE=1 ADMIN_KEY=test123 ROUND_MS=260000 PORT=8233 DATA_DIR=/tmp/impecable node server.js &`
(`ROUND_MS` must leave a lobby of at least 90 s: lobby = ROUND_MS − 140000.)

With Playwright (chromium at `/opt/pw-browsers`, flags `--no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`), at 1440×900 and at 390×844:

- Open `/`, dismiss the notice, wait for `SCENE.ready`. There must be no `pageerror`.
- Click every dock item: Home, Race, Modes, Launch, Winners, Fair, Wallet. Each must switch screens, and the Wallet item must open the wallet sheet with no demo wallet listed.
- Switch the three themes (legacy, black, white) and screenshot each on Home.
- `MR.connectDemo()`, join the race, type a name in `#youNameInput`, send a chat message: the name must appear on the player card, in the players list, and in the feed.
- Wait for the race: names must show on the labels (`SCENE.labelTexts()`), the leader in gold, no marble leaving the hopper before the gate opens.
- Wait for results: the winner's full wallet is visible, the poll shows two modes, the feed carries the WINNER line. Mark the race paid with `POST /api/admin/paid` (header `x-admin-key: test123`, body `{id, tx}`) and check the PAID link on results and the Rewards section on Home.
- On the Launch screen, fill the form and confirm the preview card updates; do not press Launch on Pons with a real wallet.
- Take screenshots of every screen and look at each one: overlapping text, clipped labels, glare, unreadable contrast, misaligned dock, buttons that look disabled when they are not. Fix what you see.

## 3. Content and copy

- English copy on the site, no placeholder text, no "lorem", no leftover "demo" wording outside the demo-mode badge.
- The brand reads "MarbleRush" with "Rush" in orange everywhere it appears.
- Nothing promises a fake transaction; every on-chain claim is backed by a real receipt or a link.

## 4. Ship

- `git add -A && git commit` with a message that says what was found and fixed.
- `git push -u origin <current branch>`; Railway deploys on push. Confirm the deployment is SUCCESS with the Railway tools if they are available.
- Rebuild and republish the one-file preview artifact if this session has one.

Finish with a short list: checks run, defects found, defects fixed, anything left and why.
