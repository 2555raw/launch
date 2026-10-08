// Short links: the receipt is sealed in the browser, the server keeps only the
// ciphertext, and /p/<id> sends the reader to the verify page.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sealText, openText, createShortLink, openShortLink, SHORT_ID } from "../js/shortlink.js";

const RECEIPT = "obx1_" + "x".repeat(900);

test("a sealed receipt opens with its key and nothing else", async () => {
  const { ct, key } = await sealText(RECEIPT);
  assert.match(key, /^[A-Za-z0-9_-]{22}$/);
  assert.ok(!ct.includes("obx1_"));
  assert.equal(await openText(ct, key), RECEIPT);
  const other = (await sealText("y")).key;
  await assert.rejects(openText(ct, other));
  // one changed character in the ciphertext is caught
  const flipped = ct.slice(0, 30) + (ct[30] === "A" ? "B" : "A") + ct.slice(31);
  await assert.rejects(openText(flipped, key));
  await assert.rejects(openText(ct, "short"));
});

test("the server stores the ciphertext, serves it back, and redirects /p/<id>", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "heldat-links-"));
  const port = 18000 + Math.floor(Math.random() * 1000);
  const server = spawn(process.execPath, [fileURLToPath(new URL("../server.js", import.meta.url))], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dir }, stdio: "ignore",
  });
  t.after(() => { server.kill(); rmSync(dir, { recursive: true, force: true }); });
  const origin = `http://localhost:${port}`;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(origin + "/health")).ok) break; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 100));
  }

  const link = await createShortLink(RECEIPT, { origin, expires: Math.floor(Date.now() / 1000) + 3600 });
  const m = link.match(/^http:\/\/localhost:\d+\/p\/([A-Za-z0-9]{8})#([A-Za-z0-9_-]{22})$/);
  assert.ok(m, link);
  assert.ok(SHORT_ID.test(m[1]));
  // what the server keeps: ciphertext only, never the receipt or the key
  const saved = readFileSync(join(dir, "links", m[1] + ".json"), "utf8");
  assert.ok(!saved.includes("obx1_") && !saved.includes(m[2]));
  assert.equal(readdirSync(join(dir, "links")).length, 1);

  assert.equal(await openShortLink(m[1], m[2], origin), RECEIPT);
  const hop = await fetch(`${origin}/p/${m[1]}`, { redirect: "manual" });
  assert.equal(hop.status, 302);
  assert.equal(hop.headers.get("location"), `/verify.html?s=${m[1]}`);

  // unknown ids, bad ids and bad bodies
  await assert.rejects(openShortLink("Zzzzzzzz", m[2], origin), (e) => e.gone === true);
  assert.equal((await fetch(`${origin}/p/../server.js`, { redirect: "manual" })).status, 404);
  assert.equal((await fetch(`${origin}/api/link/abc`)).status, 404);
  const bad = await fetch(origin + "/api/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ct: "<script>" }) });
  assert.equal(bad.status, 400);
});
