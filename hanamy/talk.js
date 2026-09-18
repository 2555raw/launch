/* ------------------------------------------------------------------
   The chat.

   It behaves like the ones people already know, with one difference
   that is the whole point: the turns on screen are on screen for the
   reader only. Every send builds a request from the composer and the
   files attached to it, and nothing else. There is no transcript array
   in this file, so there is nothing to accidentally include.
   ------------------------------------------------------------------ */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const thread = $("#t-thread");
  if (!thread) return;

  const KEY = "hanamy.endpoint";
  const MAX_TEXT = 512 * 1024;      // a file this size is already a long read
  const MAX_IMAGE = 4 * 1024 * 1024;

  const esc = (s) => String(s).replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  // What this page will call. A key the visitor set wins; otherwise the
  // deployment's own endpoint, if it has one. Its key lives on the server
  // and never reaches the browser, so there is nothing here to send.
  let hosted = false;
  const saved = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  };
  const cfg = () => saved() || (hosted ? { base: "/v1", hosted: true } : null);
  const auth = (c) => c.hosted ? {} : { Authorization: "Bearer " + c.key };
  const kb = (n) => n < 1024 ? n + " B"
                  : n < 1024 * 1024 ? (n / 1024).toFixed(0) + " KB"
                  : (n / 1048576).toFixed(1) + " MB";

  const MARK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"' +
    ' aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>';

  /* ---- the contract address -------------------------------------------
     Shown large and copied by clicking. Until one is published it says
     pending and does nothing, rather than offering an empty clipboard. */
  const caBtn = $("#ca"), caAddr = $("#ca-addr");
  if (caBtn) {
    const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);
    const ca = (window.SITE_CA || "").trim();
    const foot = $("#foot-ca");
    if (!ca) {
      caBtn.classList.add("pending");
      caAddr.textContent = "pending";
      caBtn.setAttribute("aria-label", "The contract address is not published yet");
    } else {
      caAddr.textContent = short(ca);
      caAddr.title = ca;
      if (foot) foot.textContent = short(ca);
      caBtn.addEventListener("click", async () => {
        let ok = false;
        try { await navigator.clipboard.writeText(ca); ok = true; }
        catch (e) {
          // the Clipboard API is blocked in plenty of embeds; fall back
          // rather than leaving the button silently dead
          const ta = document.createElement("textarea");
          ta.value = ca; ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.select();
          try { ok = document.execCommand("copy"); } catch (e2) {}
          ta.remove();
        }
        caBtn.classList.add("done");
        caAddr.textContent = ok ? "copied" : "press Ctrl+C";
        setTimeout(() => {
          caBtn.classList.remove("done");
          caAddr.textContent = short(ca);
        }, 1500);
      });
    }
  }

  /* ---- the endpoint --------------------------------------------------
     Set from here, because this page is the front door. Stored under the
     same key the rest of the site uses, so setting it in one place sets
     it everywhere. */
  const wire = document.getElementById("t-wire");
  const wireBtn = document.getElementById("t-endpoint");
  const wireState = document.getElementById("t-wire-state");
  const inBase = document.getElementById("t-base");
  const inKey = document.getElementById("t-key");

  function saveCfg(v) {
    try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); }
    catch (e) { /* private window: this session still works, it just will not persist */ }
  }
  function showWire(open) {
    wire.hidden = !open;
    wireBtn.setAttribute("aria-expanded", String(open));
    if (open) inBase.focus();
  }
  function wireLabel() {
    const own = saved();
    const c = cfg();
    wireBtn.textContent = own ? "Your endpoint" : (hosted ? "Endpoint" : "Set an endpoint");
    const why = document.getElementById("t-why");
    const whyHosted = document.getElementById("t-why-hosted");
    if (why) why.hidden = Boolean(hosted || own);
    if (whyHosted) whyHosted.hidden = !(hosted && !own);
    document.body.classList.toggle("needs-endpoint", !c);
    if (!wireState) return;
    wireState.textContent = own
      ? "Pointing at " + own.base + ". The key is in this browser only."
      : hosted
        ? "Using this site's own endpoint. Its key sits on the server, not in your browser, " +
          "and nothing you send is written down. You can point this somewhere else below."
        : "";
    if (own) inBase.value = own.base;
  }

  wireBtn.addEventListener("click", () => showWire(wire.hidden));
  document.getElementById("t-save").addEventListener("click", async () => {
    const base = (inBase.value || "").trim() || "https://api.groq.com/openai/v1";
    const key = (inKey.value || "").trim();
    if (!key) { wireState.textContent = "A key is needed."; return; }
    saveCfg({ base: base, key: key });
    wireLabel();
    wireState.textContent = "Saved. Asking the endpoint what it has\u2026";
    const ok = await pullModels();
    wireState.textContent = ok
      ? ok + " models loaded. Pointing at " + base + "."
      : "Saved, but that endpoint did not answer /models. Sending will still be tried.";
    note("");
    setTimeout(() => showWire(false), 900);
  });
  document.getElementById("t-forget").addEventListener("click", () => {
    saveCfg(null); inKey.value = "";
    wireLabel();
    wireState.textContent = "Forgotten.";
  });

  /* ---- the model list ------------------------------------------------ */
  const sel = $("#t-model");

  /* Which one to land on. Alphabetical order picks whatever sorts first,
     and on some providers that is a specialist: Groq's list starts with
     allam-2-7b, an Arabic-language model, so the chat answered in Arabic
     to an English question. Prefer a general-purpose model by name and
     fall back to the first only when nothing is recognised. */
  const PREFER = [
    "llama-3.3-70b", "llama-4", "llama-3.1-70b", "gpt-5", "gpt-4",
    "claude-", "gemini-2", "gemini-", "qwen", "mixtral", "mistral",
    "deepseek", "gemma", "llama"
  ];
  const AVOID = /guard|whisper|tts|embed|moderation|allam|vision-preview/i;

  function bestOf(ids) {
    const usable = ids.filter((id) => !AVOID.test(id));
    for (const want of PREFER) {
      const hit = usable.find((id) => id.toLowerCase().includes(want));
      if (hit) return hit;
    }
    return usable[0] || ids[0];
  }

  function fillModels(ids) {
    const keep = sel.value;
    sel.innerHTML = ids.map((m) => {
      const id = typeof m === "string" ? m : m.id;
      const label = typeof m === "string" ? m : (m.n || m.id);
      return `<option value="${esc(id)}">${esc(label)}</option>`;
    }).join("");
    const plain = ids.map((m) => (typeof m === "string" ? m : m.id));
    sel.value = plain.includes(keep) ? keep : bestOf(plain);
  }
  if (window.MODELS) fillModels(MODELS.filter((m) => m.s === "live"));
  async function pullModels() {
    const c = cfg();
    if (!c) return 0;
    try {
      const res = await fetch(c.base.replace(/\/$/, "") + "/models", { headers: auth(c) });
      if (!res.ok) return 0;
      const j = await res.json();
      const ids = (j.data || j.models || []).map((m) => m.id).filter(Boolean).sort();
      if (!ids.length) return 0;
      fillModels(ids);
      return ids.length;
    } catch (e) { return 0; }   // the static register stands in
  }
  pullModels();

  /* ---- attachments ---------------------------------------------------- */
  let files = [];                    // only ever the ones on the composer now
  const fileBox = $("#t-files");

  function paintFiles() {
    fileBox.hidden = !files.length;
    fileBox.className = "files chips";
    fileBox.innerHTML = files.map((f, i) => `
      <span class="chip-file">
        ${f.kind === "image" ? `<img src="${f.data}" alt="">` : ""}
        ${esc(f.name)} <span style="opacity:.6">${kb(f.size)}</span>
        <button type="button" data-i="${i}" aria-label="Remove ${esc(f.name)}">&times;</button>
      </span>`).join("");
    $$("button", fileBox).forEach((b) => b.addEventListener("click", () => {
      files.splice(Number(b.dataset.i), 1);
      paintFiles();
    }));
    foot();
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const image = file.type.startsWith("image/");
      if (image && file.size > MAX_IMAGE)
        return reject(new Error(`${file.name} is ${kb(file.size)}; images stop at ${kb(MAX_IMAGE)}`));
      if (!image && file.size > MAX_TEXT)
        return reject(new Error(`${file.name} is ${kb(file.size)}; text files stop at ${kb(MAX_TEXT)}`));
      const r = new FileReader();
      r.onerror = () => reject(new Error("could not read " + file.name));
      r.onload = () => resolve({
        name: file.name, size: file.size,
        kind: image ? "image" : "text",
        data: r.result
      });
      // Read here, in the page. The file never goes anywhere except into
      // the one request it is attached to.
      image ? r.readAsDataURL(file) : r.readAsText(file);
    });
  }

  async function take(list) {
    for (const f of list) {
      try { files.push(await readFile(f)); }
      catch (e) { note(e.message, true); }
    }
    paintFiles();
  }

  $("#t-file").addEventListener("change", (e) => {
    take([...e.target.files]);
    e.target.value = "";           // so the same file can be picked twice
  });

  const form = $("#t-form");
  ["dragenter", "dragover"].forEach((ev) => form.addEventListener(ev, (e) => {
    e.preventDefault(); form.classList.add("drop");
  }));
  ["dragleave", "drop"].forEach((ev) => form.addEventListener(ev, (e) => {
    e.preventDefault(); form.classList.remove("drop");
  }));
  form.addEventListener("drop", (e) => {
    if (e.dataTransfer && e.dataTransfer.files.length) take([...e.dataTransfer.files]);
  });

  /* ---- the thread, which is a view and not a memory -------------------- */
  const input = $("#t-input");
  function grow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, window.innerHeight * 0.4) + "px";
  }
  input.addEventListener("input", grow);

  function turnCount() { return $$(".turn.you", thread).length; }
  function foot(msg, bad) {
    const f = $("#t-foot");
    const n = turnCount();
    const held = files.length;
    f.style.color = bad ? "#a32d4e" : "";
    f.textContent = msg || (
      (n ? `${n} exchange${n === 1 ? "" : "s"} on screen, none of it sent with the next one. ` : "") +
      (held ? `${held} file${held === 1 ? "" : "s"} attached to this message only. ` : "") +
      "Reload and the screen is blank again.");
  }
  const note = (m, bad) => foot(m, bad);

  function ensureIn() {
    let box = $(".thread-in", thread);
    if (!box) {
      const empty = $("#t-empty");
      if (empty) empty.remove();
      box = document.createElement("div");
      box.className = "thread-in";
      thread.appendChild(box);
    }
    return box;
  }

  function addTurn(role, html, cls) {
    const box = ensureIn();
    // A question and its answer dim together, so the pair moves into the
    // past as one thing. Dimming on every add would grey out the question
    // the moment its own answer arrives.
    if (role === "you") $$(".turn", box).forEach((t) => t.classList.add("past"));
    const el = document.createElement("div");
    el.className = "turn " + role + (cls ? " " + cls : "");
    el.innerHTML = html;
    box.appendChild(el);
    thread.scrollTop = thread.scrollHeight;
    return el;
  }

  /* ---- the request ---------------------------------------------------- */
  // One turn. The content parts are the message and the files attached to
  // it, built fresh every time from what is in the composer right now.
  function contentFor(text) {
    const images = files.filter((f) => f.kind === "image");
    const texts = files.filter((f) => f.kind === "text");
    let body = text;
    for (const f of texts)
      body += `\n\n--- ${f.name} ---\n${f.data}`;
    if (!images.length) return body;
    return [{ type: "text", text: body }].concat(images.map((f) => ({
      type: "image_url", image_url: { url: f.data }
    })));
  }

  async function send(text) {
    const c = cfg();
    if (!c) {
      note("There is no model behind this yet. Hanamy is the interface; the answers come from " +
           "an AI provider, and one needs a key. Add one above and this will go.", true);
      showWire(true);
      return;
    }

    const shown = esc(text) + files.map((f) =>
      `\n\n<span class="meta">attached: ${esc(f.name)} (${kb(f.size)})</span>`).join("");
    addTurn("you", `<div class="role">You</div><div class="bubble">${shown}</div>`);

    const body = {
      model: sel.value,
      messages: [{ role: "user", content: contentFor(text) }],
      stream: true
    };
    // the composer is emptied here, so the files cannot ride along again
    files = []; paintFiles();
    input.value = ""; grow();

    const el = addTurn("them",
      `<div class="role"><span class="mk">${MARK}</span>Hanamy</div>` +
      `<div class="bubble">…</div><div class="meta"></div>`);
    const bubble = $(".bubble", el), meta = $(".meta", el);
    const t0 = performance.now();
    let first = 0;

    try {
      const res = await fetch(c.base.replace(/\/$/, "") + "/chat/completions", {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, auth(c)),
        body: JSON.stringify(body)
      });
      const type = res.headers.get("content-type") || "";

      if (!res.ok || !type.includes("event-stream") || !res.body) {
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(
          (j.error && (j.error.message || j.error.code)) || ("HTTP " + res.status));
        const m = j.choices && j.choices[0] && j.choices[0].message;
        bubble.textContent = (m && m.content) || "(empty answer)";
      } else {
        const reader = res.body.getReader(), dec = new TextDecoder();
        let buf = "", out = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop();
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            let j; try { j = JSON.parse(payload); } catch (e) { continue; }
            const d = j.choices && j.choices[0] && j.choices[0].delta;
            if (!d || !d.content) continue;
            if (!first) first = Math.round(performance.now() - t0);
            out += d.content;
            bubble.textContent = out;
            thread.scrollTop = thread.scrollHeight;
          }
        }
        if (!out) bubble.textContent = "(empty answer)";
      }
      meta.textContent = (first ? first + " ms to first token · " : "") +
        Math.round(performance.now() - t0) + " ms · this turn was sent on its own";
    } catch (e) {
      bubble.textContent = e.message;
      bubble.classList.add("bad");
      meta.textContent = "failed";
    }
    foot();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text && !files.length) return;
    send(text || "(see the attached file)");
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });
  $$("#t-empty .seeds button").forEach((b) => b.addEventListener("click", () => {
    input.value = b.textContent.trim(); grow(); input.focus();
  }));
  $("#t-clear").addEventListener("click", () => {
    thread.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "empty blank";
    empty.id = "t-empty";
    empty.innerHTML = `<div class="empty-in"><h1>Blank again.</h1>
      <p>Nothing was saved on the way out.</p></div>`;
    thread.appendChild(empty);
    files = []; paintFiles();
    foot();
  });

  // Ask the deployment whether it has a key of its own before deciding
  // that there is nowhere to send anything.
  fetch("/hosted", { cache: "no-store" })
    .then((r) => r.ok ? r.json() : null)
    .then((j) => { hosted = Boolean(j && j.hosted); })
    .catch(() => { hosted = false; })
    .then(() => { wireLabel(); pullModels(); foot(); });

  wireLabel();
  foot();
})();
