/* Shared behaviour. Small on purpose: this is a marketing site with one
   real interaction (the comparison) and a handful of conveniences. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  $$("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));

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

  /* ---- the compare panel ------------------------------------------- */
  const a = $("#modelA"), b = $("#modelB");
  if (a && b && window.MODELS) {
    const opts = MODELS.filter((m) => m.s === "live");
    const fill = (sel, i) => {
      sel.innerHTML = opts.map((m, j) =>
        `<option value="${esc(m.id)}"${j === i ? " selected" : ""}>${esc(m.n)}</option>`).join("");
    };
    fill(a, 0); fill(b, 3);
    const prov = (sel, out) => {
      const m = opts.find((x) => x.id === sel.value);
      if (m && out) out.textContent = m.lab;
    };
    const pa = $("#provA"), pb = $("#provB");
    const sync = () => { prov(a, pa); prov(b, pb); };
    a.addEventListener("change", sync); b.addEventListener("change", sync); sync();

    const go = $("#compare-go");
    if (go) go.addEventListener("click", () => {
      const out = $("#compare-out");
      if (!out) return;
      const q = ($("#compare-q").value || "").trim();
      out.hidden = false;
      out.textContent = q
        ? "The comparison runs against the shared pool. This build is the front end only — " +
          "wire #compare-go to /v1/chat/completions and stream both answers into this panel."
        : "Type a question first.";
    });
  }

  /* ---- back to top -------------------------------------------------- */
  const up = $("#totop");
  if (up) up.addEventListener("click", (e) => {
    e.preventDefault();
    scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
})();
