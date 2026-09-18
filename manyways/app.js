/* Shared behaviour. Small on purpose: this is a marketing site with one
   real interaction (the comparison) and a handful of conveniences. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  $$("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));

  /* ---- the rail flyouts ----------------------------------------------
     Click opens and closes. With a real pointer, running down the rail
     moves the open panel with the cursor — which needs its own "the rail
     is active" flag, because mouseleave on one icon fires before
     mouseenter on the next. */
  const menus = $$(".rail .menu");
  if (menus.length) {
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    let open = null, armed = false;

    function show(m) {
      if (open === m) return;
      if (open) close();
      open = m;
      $("button", m).setAttribute("aria-expanded", "true");
      const pop = $(".pop", m);
      pop.hidden = false;
      // keep the panel on screen when the icon sits low in the rail
      pop.style.top = "-8px"; pop.style.bottom = "auto";
      const r = pop.getBoundingClientRect();
      if (r.bottom > innerHeight - 12) { pop.style.top = "auto"; pop.style.bottom = "-8px"; }
    }
    function close() {
      if (!open) return;
      $("button", open).setAttribute("aria-expanded", "false");
      $(".pop", open).hidden = true;
      open = null;
    }

    menus.forEach((m) => {
      const btn = $("button", m);
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (open === m) { close(); armed = false; }
        else { armed = true; show(m); }
      });
      if (fine) m.addEventListener("mouseenter", () => { if (armed) show(m); });
      m.addEventListener("focusout", (e) => {
        if (open === m && !m.contains(e.relatedTarget)) { close(); armed = false; }
      });
    });
    const rail = $(".rail");
    if (fine && rail) rail.addEventListener("mouseleave", (e) => {
      if (!rail.contains(e.relatedTarget)) { close(); armed = false; }
    });
    document.addEventListener("click", () => { close(); armed = false; });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !open) return;
      const btn = $("button", open);
      close(); armed = false; btn.focus();
    });
  }

  /* ---- the drawer, for screens too narrow for the rail --------------- */
  const burger = $("#burger"), drawer = $("#drawer");
  if (burger && drawer) {
    burger.addEventListener("click", () => {
      const open = burger.getAttribute("aria-expanded") !== "true";
      burger.setAttribute("aria-expanded", String(open));
      drawer.hidden = !open;
    });
  }

  /* ---- copy buttons ------------------------------------------------ */
  $$("[data-copy]").forEach((b) => {
    b.addEventListener("click", async () => {
      const src = $(b.getAttribute("data-copy"));
      const text = src ? src.innerText : b.getAttribute("data-text") || "";
      let done = false;
      try { await navigator.clipboard.writeText(text); done = true; }
      catch (_) {
        // Clipboard API is blocked in plenty of embeds. Fall back rather
        // than leaving the button silently dead.
        const t = document.createElement("textarea");
        t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
        document.body.appendChild(t); t.select();
        try { done = document.execCommand("copy"); } catch (e) {}
        t.remove();
      }
      const old = b.getAttribute("aria-label") || b.textContent;
      b.setAttribute("aria-label", done ? "Copied" : "Press Ctrl+C");
      if (b.dataset.label) b.textContent = done ? "Copied" : "Press Ctrl+C";
      setTimeout(() => {
        b.setAttribute("aria-label", old);
        if (b.dataset.label) b.textContent = b.dataset.label;
      }, 1600);
    });
  });

  /* ---- tab groups -------------------------------------------------- */
  $$("[data-tabs]").forEach((group) => {
    const btns = $$("button", group);
    btns.forEach((b) => b.addEventListener("click", () => {
      btns.forEach((o) => {
        o.setAttribute("aria-selected", String(o === b));
        const p = $("#" + o.getAttribute("aria-controls"));
        if (p) p.hidden = o !== b;
      });
    }));
  });

  /* ---- the model register ------------------------------------------ */
  const rows = $("#rows");
  if (rows && window.MODELS) {
    const fmt = (n) => (n >= 1000000 ? n / 1000000 + "M" : n / 1000 + "K");
    const usd = (n) => "$" + (n < 1 ? n.toFixed(2) : n.toFixed(n % 1 ? 2 : 0));
    let lab = "All";
    function paint() {
      const list = MODELS.filter((m) => lab === "All" || m.lab === lab);
      rows.innerHTML = list.map((m) => `
        <tr>
          <td><span class="mname"><span class="dot" style="background:${LABS[m.lab]}"></span>
            <span><b>${esc(m.n)}</b><br><span class="id">${esc(m.id)}</span></span></span></td>
          <td>${esc(m.lab)}</td>
          <td class="r num">${fmt(m.ctx)}</td>
          <td class="r num">${usd(m.in)}</td>
          <td class="r num">${usd(m.out)}</td>
          <td><span class="tag ${m.s === "live" ? "live" : ""}">${m.s === "live" ? "In the pool" : "Queued"}</span></td>
        </tr>`).join("");
      const note = $("#tnote");
      if (note) note.textContent =
        `${list.length} of ${MODELS.length} models shown. Prices are per million tokens, ` +
        `charged by the pool. Placeholder figures in this build.`;
    }
    const fbox = $("#filters");
    if (fbox) {
      const labs = ["All", ...Object.keys(LABS)];
      fbox.innerHTML = labs.map((l) =>
        `<button class="f${l === "All" ? " on" : ""}" type="button">${esc(l)}</button>`).join("") +
        `<span class="far" id="tcount"></span>`;
      $$("button", fbox).forEach((b) => b.addEventListener("click", () => {
        lab = b.textContent;
        $$("button", fbox).forEach((o) => o.classList.toggle("on", o === b));
        paint();
      }));
    }
    paint();
    const sm = $("#s-models"), sl = $("#s-labs");
    if (sm) sm.textContent = MODELS.length;
    if (sl) sl.textContent = Object.keys(LABS).length;
  }

  /* ---- the compare panel --------------------------------------------
     This actually calls something. Point it at any OpenAI-compatible
     endpoint and give it a key; both live in this browser's localStorage
     and go nowhere but the endpoint named here. With no key it falls
     back to the static register for the two dropdowns and says plainly,
     before you click, that it has nothing to call. */
  const selA = $("#modelA"), selB = $("#modelB");
  if (selA && selB) {
    const KEY = "mw.endpoint";
    const msg = $("#compare-msg"), out = $("#answers");
    const wire = $("#wire"), inBase = $("#w-base"), inKey = $("#w-key"), state = $("#w-state");

    const load = () => {
      try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
    };
    const save = (v) => {
      try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); }
      catch (e) { /* private window: the session still works, it just won't persist */ }
    };
    const say = (t, bad) => {
      if (!msg) return;
      msg.hidden = !t; msg.textContent = t || "";
      msg.style.color = bad ? "#a32d4e" : "";
    };

    let live = null;   // ids the endpoint reported, once a key is in

    function fill(ids) {
      const opts = ids.map((m) => typeof m === "string"
        ? { id: m, n: m, lab: "" } : m);
      [selA, selB].forEach((sel, i) => {
        const keep = sel.value;
        sel.innerHTML = opts.map((m) =>
          `<option value="${esc(m.id)}">${esc(m.n || m.id)}</option>`).join("");
        sel.value = opts.some((m) => m.id === keep) ? keep
                  : (opts[Math.min(i * 3, opts.length - 1)] || opts[0] || {}).id || "";
      });
      syncLab();
    }
    function syncLab() {
      const lab = (sel, el) => {
        if (!el) return;
        const m = (window.MODELS || []).find((x) => x.id === sel.value);
        el.textContent = live ? (new URL(load().base).host) : (m ? m.lab : "");
      };
      lab(selA, $("#provA")); lab(selB, $("#provB"));
    }
    selA.addEventListener("change", syncLab);
    selB.addEventListener("change", syncLab);

    // start from the published register, so the panel is never empty
    if (window.MODELS) fill(MODELS.filter((m) => m.s === "live"));

    /* ---- the endpoint form ---- */
    if ($("#w-toggle")) $("#w-toggle").addEventListener("click", () => {
      wire.hidden = !wire.hidden;
      if (!wire.hidden) inBase.focus();
    });
    const saved = load();
    if (saved) {
      // A saved key has to be visible: otherwise its state, and the button
      // that forgets it, sit behind a disclosure nobody has opened.
      inBase.value = saved.base;
      wire.hidden = false;
      state.textContent = "Key saved in this browser. Loading models…";
      pullModels(saved.base, saved.key).then((ids) => {
        live = ids; fill(ids);
        state.textContent = ids.length + " models loaded · key saved in this browser.";
      }).catch((e) => {
        state.textContent = "Key saved, but the endpoint did not answer: " + e.message;
      });
    }

    async function pullModels(base, key) {
      const res = await fetch(base.replace(/\/$/, "") + "/models",
        { headers: { Authorization: "Bearer " + key } });
      if (!res.ok) throw new Error("HTTP " + res.status + " from /models");
      const j = await res.json();
      const ids = (j.data || j.models || []).map((m) => m.id).filter(Boolean).sort();
      if (!ids.length) throw new Error("the endpoint listed no models");
      return ids;
    }

    if ($("#w-save")) $("#w-save").addEventListener("click", async () => {
      const base = (inBase.value || "").trim() || "https://api.openai.com/v1";
      const key = (inKey.value || "").trim();
      if (!key) { state.textContent = "A key is needed."; return; }
      state.textContent = "Asking the endpoint what it has…";
      try {
        const ids = await pullModels(base, key);
        save({ base: base, key: key });
        live = ids; fill(ids);
        state.textContent = ids.length + " models loaded.";
        say("");
      } catch (e) {
        state.textContent = "";
        say("Could not reach that endpoint: " + e.message +
            ". A browser call also needs the endpoint to allow CORS from this page.", true);
      }
    });
    if ($("#w-clear")) $("#w-clear").addEventListener("click", () => {
      save(null); live = null; inKey.value = ""; state.textContent = "Forgotten.";
      if (window.MODELS) fill(MODELS.filter((m) => m.s === "live"));
    });

    /* ---- the call ----
       Streamed, so an answer arrives as it is written rather than landing
       in one lump after ten seconds of nothing. An endpoint that will not
       stream still works: if the body is not an event stream we read it as
       one JSON response. */
    async function ask(base, key, model, prompt, onChunk) {
      const t0 = performance.now();
      let first = 0;
      const res = await fetch(base.replace(/\/$/, "") + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({
          model: model, messages: [{ role: "user", content: prompt }], stream: true
        })
      });
      const type = res.headers.get("content-type") || "";

      if (!res.ok || !type.includes("event-stream") || !res.body) {
        const j = await res.json().catch(() => ({}));
        const ms = Math.round(performance.now() - t0);
        if (!res.ok) {
          const m = (j.error && (j.error.message || j.error.code)) || ("HTTP " + res.status);
          throw Object.assign(new Error(m), { ms: ms });
        }
        const c = j.choices && j.choices[0] && j.choices[0].message;
        const text = (c && c.content) || "(empty answer)";
        onChunk(text);
        return { text: text, ms: ms, first: ms, usage: j.usage || null, streamed: false };
      }

      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = "", text = "", usage = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();                       // keep the partial line
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let j; try { j = JSON.parse(payload); } catch (e) { continue; }
          if (j.usage) usage = j.usage;
          const d = j.choices && j.choices[0] && j.choices[0].delta;
          const piece = d && d.content;
          if (!piece) continue;
          if (!first) first = Math.round(performance.now() - t0);
          text += piece;
          onChunk(text);
        }
      }
      return { text: text || "(empty answer)", ms: Math.round(performance.now() - t0),
               first: first, usage: usage, streamed: true };
    }

    const go = $("#compare-go");
    if (go) go.addEventListener("click", async () => {
      const q = ($("#compare-q").value || "").trim();
      if (!q) { say("Type a question first."); return; }
      const cfg = load();
      if (!cfg) {
        wire.hidden = false;
        say("Nothing to call yet — name an OpenAI-compatible endpoint and key below. " +
            "They stay in this browser.");
        inBase.focus();
        return;
      }
      say("");
      out.hidden = false;
      const pairs = [[selA, "#ans-a", "#ans-a-name", "#ans-a-meta"],
                     [selB, "#ans-b", "#ans-b-name", "#ans-b-meta"]];
      pairs.forEach(([sel, body, name, meta]) => {
        $(name).textContent = sel.value;
        $(body).textContent = "…"; $(body).classList.remove("bad");
        $(meta).textContent = "";
      });
      go.disabled = true;
      await Promise.all(pairs.map(async ([sel, body, , meta]) => {
        try {
          const r = await ask(cfg.base, cfg.key, sel.value, q,
                              (so_far) => { $(body).textContent = so_far; });
          $(body).textContent = r.text;
          $(meta).textContent = (r.first ? r.first + " ms to first token · " : "") +
            r.ms + " ms total" + (r.usage
              ? " · " + (r.usage.prompt_tokens || 0) + " in / " + (r.usage.completion_tokens || 0) + " out"
              : "");
        } catch (e) {
          $(body).textContent = e.message;
          $(body).classList.add("bad");
          $(meta).textContent = (e.ms || 0) + " ms · failed";
        }
      }));
      go.disabled = false;
    });
  }

  /* ---- back to top -------------------------------------------------- */
  const up = $("#totop");
  if (up) up.addEventListener("click", (e) => {
    e.preventDefault();
    scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
})();
