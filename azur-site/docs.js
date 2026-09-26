// AZUR docs: sidebar toggle, search filter, Ctrl/Cmd+K, and "On this page" scroll tracking.
(function () {
  "use strict";
  const body = document.body;
  const open = document.getElementById("sideOpen");
  const mobile = () => window.matchMedia("(max-width: 820px)").matches;

  document.getElementById("sideToggle").addEventListener("click", () => {
    if (mobile()) { body.classList.remove("menu"); return; }
    body.classList.add("collapsed");
    open.hidden = false;
  });
  open.addEventListener("click", () => {
    if (mobile()) { body.classList.toggle("menu"); return; }
    body.classList.remove("collapsed");
    open.hidden = true;
  });
  if (mobile()) open.hidden = false;
  document.querySelectorAll(".side-nav a").forEach((a) => a.addEventListener("click", () => body.classList.remove("menu")));

  // Search: hides the sections (and their index links) that do not match.
  const q = document.getElementById("q");
  const sections = [...document.querySelectorAll(".content section")];
  const tocLinks = [...document.querySelectorAll("#toc a")];
  const navLinks = [...document.querySelectorAll(".side-nav a")];
  const noHits = document.getElementById("noHits");
  q.addEventListener("input", () => {
    const term = q.value.trim().toLowerCase();
    let hits = 0;
    sections.forEach((s) => {
      const text = (s.dataset.k + " " + s.textContent).toLowerCase();
      const match = !term || text.includes(term);
      s.classList.toggle("hide", !match);
      if (match) hits++;
      tocLinks.filter((a) => a.hash === "#" + s.id).forEach((a) => (a.hidden = !match));
    });
    navLinks.forEach((a) => {
      const target = a.hash === "#top" ? null : document.querySelector(a.hash);
      a.hidden = !!(term && target && target.classList.contains("hide"));
    });
    noHits.hidden = hits > 0;
    const first = sections.find((s) => !s.classList.contains("hide"));
    if (term && first) first.scrollIntoView({ block: "start" });
  });
  // Search palette: the magnifier, the sidebar box and Ctrl/Cmd+K all open it.
  const palette = document.getElementById("palette");
  const palQ = document.getElementById("palQ");
  const palResults = document.getElementById("palResults");
  const palCount = document.getElementById("palCount");
  const ICONS = { need: "✓", install: "↓", home: "⌂", funds: "$", thread: "✦", autonomy: "⚑", chain: "⛓", alerts: "🔔", faq: "?", next: "→" };
  const esc = (t) => t.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  // one entry per section heading, plus one per paragraph, list item and FAQ answer
  const index = [];
  sections.forEach((s) => {
    const title = s.querySelector("h2").textContent;
    index.push({ id: s.id, title, text: s.dataset.k || "", head: true });
    s.querySelectorAll("p, li, summary").forEach((el) => {
      if (el.closest("figure")) return;
      index.push({ id: s.id, title, text: el.textContent.trim().replace(/\s+/g, " ") });
    });
  });
  let results = [], sel = 0, lastFocus = null;

  function snippet(text, term) {
    const i = text.toLowerCase().indexOf(term);
    if (i < 0) return esc(text.slice(0, 120));
    const start = Math.max(0, i - 40);
    const part = text.slice(start, i + term.length + 80);
    const j = i - start;
    return (start ? "…" : "") + esc(part.slice(0, j)) + "<mark>" + esc(part.slice(j, j + term.length)) + "</mark>" + esc(part.slice(j + term.length));
  }

  function render() {
    const term = palQ.value.trim().toLowerCase();
    if (!term) {
      results = sections.map((s) => ({ id: s.id, title: s.querySelector("h2").textContent, sn: esc(s.querySelector("p, li") ? s.querySelector("p, li").textContent.trim().slice(0, 90) : "") + "…" }));
      palCount.textContent = results.length + " sections";
    } else {
      // paragraphs first; a section that only matches on its keywords or title
      // shows its opening line instead of the keyword list
      const hitIds = new Set();
      results = [];
      index.forEach((e) => {
        if (e.head || !e.text.toLowerCase().includes(term)) return;
        hitIds.add(e.id);
        results.push({ id: e.id, title: e.title, sn: snippet(e.text, term), rank: e.title.toLowerCase().includes(term) ? 0 : 1 });
      });
      index.forEach((e) => {
        if (!e.head || hitIds.has(e.id)) return;
        if (!e.title.toLowerCase().includes(term) && !e.text.toLowerCase().includes(term)) return;
        const first = document.getElementById(e.id).querySelector("p, li");
        results.push({ id: e.id, title: e.title, sn: esc(first ? first.textContent.trim().slice(0, 110) + "…" : ""), rank: 0 });
      });
      results.sort((a, b) => a.rank - b.rank).splice(12);
      palCount.textContent = results.length ? results.length + (results.length === 1 ? " result" : " results") : "";
    }
    sel = 0;
    if (!results.length) {
      palResults.innerHTML = '<div class="pal-empty"><b>🔭</b>Nothing for “' + esc(palQ.value.trim()) + '”.<br>Even the agent could not find it. Try “funds”, “alerts” or “Pons”.</div>';
      return;
    }
    palResults.innerHTML = '<div class="pal-group">' + (term ? "Results" : "Jump to") + "</div>" +
      results.map((r, i) =>
        '<button type="button" class="pal-item' + (i === 0 ? " sel" : "") + '" role="option" data-i="' + i + '">' +
        '<span class="ic">' + (ICONS[r.id] || "#") + '</span><span class="tx"><span class="tt">' + esc(r.title) + '</span><span class="sn">' + r.sn + "</span></span>" +
        '<span class="go">↵</span></button>').join("");
  }

  function move(d) {
    const items = palResults.querySelectorAll(".pal-item");
    if (!items.length) return;
    items[sel].classList.remove("sel");
    sel = (sel + d + items.length) % items.length;
    items[sel].classList.add("sel");
    items[sel].scrollIntoView({ block: "nearest" });
  }

  function go(i) {
    const r = results[i];
    if (!r) return;
    closePalette();
    const target = document.getElementById(r.id);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.remove("flash");
    void target.offsetWidth;
    target.classList.add("flash");
    history.replaceState(null, "", "#" + r.id);
  }

  function openPalette() {
    lastFocus = document.activeElement;
    body.classList.remove("menu");
    palette.hidden = false;
    palQ.value = "";
    render();
    palQ.focus();
  }
  function closePalette() {
    palette.hidden = true;
    if (lastFocus && lastFocus !== q) lastFocus.focus();
  }

  document.getElementById("searchBtn").addEventListener("click", openPalette);
  q.addEventListener("focus", () => { q.blur(); openPalette(); });
  q.closest(".search").addEventListener("click", (e) => { e.preventDefault(); openPalette(); });
  palQ.addEventListener("input", render);
  palResults.addEventListener("click", (e) => {
    const b = e.target.closest(".pal-item");
    if (b) go(+b.dataset.i);
  });
  palResults.addEventListener("mousemove", (e) => {
    const b = e.target.closest(".pal-item");
    if (!b || +b.dataset.i === sel) return;
    move(+b.dataset.i - sel);
  });
  palette.addEventListener("click", (e) => { if (e.target === palette) closePalette(); });
  palQ.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    if (e.key === "Enter") { e.preventDefault(); go(sel); }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      palette.hidden ? openPalette() : closePalette();
    }
    if (e.key === "/" && palette.hidden && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      e.preventDefault();
      openPalette();
    }
    if (e.key === "Escape") {
      if (!palette.hidden) closePalette();
      body.classList.remove("menu");
    }
  });

  // Section picker jumps to that part of the page.
  document.getElementById("product").addEventListener("change", (e) => {
    const id = e.target.selectedIndex === 1 ? "chain" : "top";
    document.getElementById(id).scrollIntoView({ behavior: "smooth" });
  });

  // "On this page": each link gets its own reading time, and the rail is a
  // little price line through the links that fills in as you scroll.
  const rail = document.getElementById("tocRail");
  const railBg = rail.querySelector(".rail-bg");
  const railFg = rail.querySelector(".rail-fg");
  const railNodes = rail.querySelector(".rail-nodes");
  const dot = rail.querySelector(".rail-dot");
  const ping = rail.querySelector(".rail-ping");
  const pct = document.getElementById("tocPct");
  const left = document.getElementById("tocLeft");
  const toTop = document.getElementById("toTop");
  const words = (el) => el.textContent.trim().split(/\s+/).length;
  const WPM = 220;
  const totalWords = sections.reduce((n, s) => n + words(s), 0);
  tocLinks.forEach((a) => {
    const s = document.querySelector(a.hash);
    a.dataset.min = Math.max(1, Math.round(words(s) / WPM * 60)) + "s";
  });

  let pts = [], lens = [], total = 0, visible = [];
  function layout() {
    visible = tocLinks.filter((a) => !a.hidden);
    const h = rail.parentElement.offsetHeight;
    // zigzag like a chart: alternate the line left and right of the centre
    pts = visible.map((a, i) => ({
      x: a.classList.contains("sub") ? 18 : i % 2 ? 15 : 7,
      y: a.offsetTop + a.offsetHeight / 2,
    }));
    const all = [{ x: 11, y: 0 }].concat(pts, [{ x: 11, y: h }]);
    const d = all.map((p, i) => (i ? "L" : "M") + p.x + " " + p.y).join(" ");
    railBg.setAttribute("d", d);
    railFg.setAttribute("d", d);
    lens = [0];
    for (let i = 1; i < all.length; i++) lens.push(lens[i - 1] + Math.hypot(all[i].x - all[i - 1].x, all[i].y - all[i - 1].y));
    total = lens[lens.length - 1];
    pts = all;
    railNodes.innerHTML = visible.map((a, i) => '<circle r="3.2" cx="' + all[i + 1].x + '" cy="' + all[i + 1].y + '"/>').join("");
    track();
  }

  function track() {
    const shown = sections.filter((s) => !s.classList.contains("hide"));
    const line = window.innerHeight * 0.35;
    let idx = 0;
    shown.forEach((s, i) => { if (s.getBoundingClientRect().top < line) idx = i; });
    const cur = shown[idx] || sections[0];

    // how far into the current section the reading line is (0..1)
    const top = cur.getBoundingClientRect().top;
    const next = shown[idx + 1];
    const span = next ? next.getBoundingClientRect().top - top : cur.offsetHeight;
    const f = Math.min(1, Math.max(0, (line - top) / Math.max(span, 1)));

    // map that onto the rail: point idx+1 is this section's node
    const ti = visible.findIndex((a) => a.hash === "#" + cur.id);
    const atStart = window.scrollY < 40;
    let len = 0, p = pts[0] || { x: 11, y: 0 };
    if (ti >= 0 && pts.length && !atStart) {
      const a = ti + 1, b = Math.min(ti + 2, pts.length - 1);
      len = lens[a] + (lens[b] - lens[a]) * f;
      p = { x: pts[a].x + (pts[b].x - pts[a].x) * f, y: pts[a].y + (pts[b].y - pts[a].y) * f };
    }
    railFg.style.strokeDasharray = len + " " + (total + 1);
    dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y);
    ping.setAttribute("cx", p.x); ping.setAttribute("cy", p.y);

    visible.forEach((a, i) => {
      const done = !atStart && i < ti, on = !atStart && i === ti;
      a.classList.toggle("done", done);
      a.classList.toggle("on", on);
      const node = railNodes.children[i];
      if (node) { node.classList.toggle("done", done); node.classList.toggle("on", on); }
    });
    const navHit = navLinks.find((a) => a.hash === "#" + cur.id);
    navLinks.forEach((a) => a.classList.toggle("active", navHit ? a === navHit : a.hash === "#top"));

    // reading progress ticker and time left
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const r = max > 0 ? Math.min(1, window.scrollY / max) : 1;
    const n = Math.round(r * 100);
    pct.querySelector("b").textContent = n + "%";
    pct.classList.toggle("done", n >= 99);
    const mins = Math.ceil(totalWords * (1 - r) / WPM);
    left.textContent = n >= 99 ? "All caught up" : mins <= 1 ? "Under a minute left" : mins + " min left";
    toTop.classList.toggle("show", r > 0.15);
  }

  window.addEventListener("scroll", track, { passive: true });
  window.addEventListener("resize", layout);
  q.addEventListener("input", () => requestAnimationFrame(layout));
  document.fonts ? document.fonts.ready.then(layout) : window.addEventListener("load", layout);
  layout();

  // Demo buttons on the approval card.
  document.querySelectorAll(".confirm-btns button").forEach((b) =>
    b.addEventListener("click", () => {
      const card = b.closest(".confirm");
      card.querySelector("p").textContent = b.classList.contains("ok")
        ? "Approved. Order sent: 10 HOOD filled at $54.91."
        : "Declined. Nothing was sent.";
      card.querySelector(".confirm-btns").remove();
    })
  );
})();
