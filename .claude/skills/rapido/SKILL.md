---
name: rapido
description: Speed pass on MarbleRush. Measures what the page weighs and how fast it paints and runs, cuts the worst offenders, and proves the numbers moved.
---

# /rapido

From `marble-royale/`. Measure first, change second, measure again. Never trade correctness for speed.

1. **Weight.** `du -b public/**/*` and the transfer size of every request Playwright records on a cold load. Anything over 150 KB that is not three.js needs a reason.
2. **Paint.** With Playwright, record `performance.timing` and the paint entries on a cold load of `/`: time to first paint and to `SCENE.ready`. Do three runs and take the middle one.
3. **Frames.** During a race, sample `requestAnimationFrame` deltas for ten seconds at 1440x900 and report the median and the worst frame. Do the same at 390x844.
4. **Draw calls.** `SCENE` exposes the renderer; log `renderer.info.render.calls` and `.triangles` mid-race. Note what dominates.
5. Cut what the numbers point at: lazy work that is not needed before the first paint, textures larger than they render, per-frame allocations, sprites that could be reused, snapshots rendered when they are not visible.
6. Re-measure and print a before and after table. Then run `node test/engine.test.js` and follow `/deploy`.

Report: the before and after numbers, what was changed, anything left slow and why.
