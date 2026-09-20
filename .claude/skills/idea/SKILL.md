---
name: idea
description: Propose the next improvements to MarbleRush, ranked by what they would do for the player, then build the one that is chosen end to end.
---

# /idea

From `marble-royale/`. Read the code before proposing anything; no idea that the code already does.

1. Read `README.md`, `lib/round.js`, `public/js/app.js` and the screens in `public/index.html` to know what exists today.
2. Propose six improvements. For each: one line on what the player gets, the files it touches, the risk, and a rough size (an hour, an afternoon, a day). Rank them by what they do for a first-time visitor and for someone who comes back.
3. If the user names one, build it completely: server, page, styles, the one-file build, and a Playwright check that proves it works. If the user names none, build the top one and say why.
4. Never add anything that fakes a transaction, invents a figure, or asks for a key.
5. `node test/engine.test.js`, then follow `/deploy`.

Report: the six ideas, which was built, how it was verified.
