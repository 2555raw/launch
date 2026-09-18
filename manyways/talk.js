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
  const cfg = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  };
  const kb = (n) => n < 1024 ? n + " B"
                  : n < 1024 * 1024 ? (n / 1024).toFixed(0) + " KB"
                  : (n / 1048576).toFixed(1) + " MB";

  const MARK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"' +
    ' aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>';

  /* ---- the model list ------------------------------------------------ */
  const sel = $("#t-model");
  function fillModels(ids) {
    sel.innerHTML = ids.map((m) => {
      const id = typeof m === "string" ? m : m.id;
      const label = typeof m === "string" ? m : (m.n || m.id);
      return `<option value="${esc(id)}">${esc(label)}</option>`;
    }).join("");
  }
  if (window.MODELS) fillModels(MODELS.filter((m) => m.s === "live"));
  (async function pull() {
    const c = cfg();
    if (!c) return;
    try {
      const res = await fetch(c.base.replace(/\/$/, "") + "/models",
        { headers: { Authorization: "Bearer " + c.key } });
      if (!res.ok) return;
      const j = await res.json();
      const ids = (j.data || j.models || []).map((m) => m.id).filter(Boolean).sort();
      if (ids.length) fillModels(ids);
    } catch (e) { /* the static register stands in */ }
  })();

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
    const c = $("#t-count");
    if (c) c.textContent = n ? `${n} on screen · 0 remembered` : "nothing on screen";
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
      note("No endpoint yet. Set one on the home page, under “Use your own endpoint”.", true);
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
      `<div class="role"><span class="mk">${MARK}</span>Tsubomi</div>` +
      `<div class="bubble">…</div><div class="meta"></div>`);
    const bubble = $(".bubble", el), meta = $(".meta", el);
    const t0 = performance.now();
    let first = 0;

    try {
      const res = await fetch(c.base.replace(/\/$/, "") + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + c.key },
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
    empty.className = "empty";
    empty.id = "t-empty";
    empty.innerHTML = `<h1>Blank again.</h1><p>Nothing was saved on the way out.</p>`;
    thread.appendChild(empty);
    files = []; paintFiles();
    foot();
  });

  foot();
})();
