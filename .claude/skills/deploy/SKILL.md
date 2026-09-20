---
name: deploy
description: Ship MarbleRush: run the tests, rebuild the one-file preview, commit with a real message, push to the working branch, confirm the Railway deployment is SUCCESS and republish the preview artifact.
---

# /deploy

From `marble-royale/`. Never push something you have not run.

1. `node test/engine.test.js` must print all checks passed. If it does not, fix the cause; never weaken a test.
2. Every script parses:
   `for f in server.js lib/*.js public/js/*.js public/js/**/*.js public/shared/*.js public/render.js public/admin.js; do node -e "new (require('vm').Script)(require('fs').readFileSync('$f','utf8'))" || echo "BROKEN $f"; done`
3. `node preview/build-app.js`, then load `preview/dist/marble-royale.html` in Playwright and confirm there is no `pageerror`.
4. Start a demo server on port 8233 and load `/` once in Playwright: no `pageerror`, `SCENE.ready` true, the dock visible.
5. `git add -A`, commit with a message that says what changed and why (no model names), `git push -u origin claude/modest-gates-a3r2qi`. Retry a network failure up to four times with 2s, 4s, 8s, 16s backoff.
6. Wait about ninety seconds, then confirm with the Railway tools that the newest deployment for service `launch` in project `protective-nature` is SUCCESS. If it FAILED, read the build logs, fix, and push again.
7. Republish the one-file preview to the session's artifact if there is one.

Report: what was tested, the commit subject, the deployment status, the artifact link.
