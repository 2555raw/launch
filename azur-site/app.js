// AZUR — charts, feed marquee, cycling prompt bubbles and hub wiring.
(function () {
  "use strict";

  // Asset badges. Bitcoin and Ethereum use their openly licensed marks; every
  // other ticker shows as text unless assets/logos/<ticker>.png exists, in which
  // case that file is drawn over it (add official logos there if you have the
  // right to use them).
  const MARKS = {
    BTC: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#f7931a"/><path fill="#fff" d="M46.1 27.4c.6-4.2-2.6-6.5-7-8l1.4-5.7-3.5-.9-1.4 5.6-2.8-.7 1.4-5.6-3.5-.9-1.4 5.7-2.2-.5-4.8-1.2-.9 3.7s2.6.6 2.5.6c1.4.4 1.7 1.3 1.6 2l-1.6 6.5.4.1-.4-.1-2.3 9.1c-.2.4-.6 1.1-1.6.8l-2.5-.6-1.7 4 4.6 1.1 2.5.7-1.4 5.8 3.5.9 1.4-5.7 2.8.7-1.4 5.7 3.5.9 1.4-5.8c6 1.1 10.5.7 12.4-4.7 1.5-4.4-.1-6.9-3.2-8.5 2.3-.5 4-2 4.4-5.1zm-8 11.2c-1.1 4.4-8.4 2-10.8 1.4l1.9-7.7c2.4.6 10 1.8 8.9 6.3zm1.1-11.3c-1 4-7.1 2-9.1 1.5l1.8-7c2 .5 8.3 1.4 7.3 5.5z"/></svg>',
    ETH: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#627eea"/><g fill="#fff"><path fill-opacity=".6" d="M32 8v17.7l15 6.7z"/><path d="M32 8 17 32.4l15-6.7z"/><path fill-opacity=".6" d="M32 44v12l15-20.8z"/><path d="M32 56V44l-15-8.8z"/><path fill-opacity=".2" d="m32 41.2 15-8.8-15-6.7z"/><path fill-opacity=".6" d="m17 32.4 15 8.8V25.7z"/></g></svg>'
  };
  document.querySelectorAll(".coin[data-t]").forEach((el) => {
    const t = el.dataset.t;
    if (MARKS[t]) { el.innerHTML = MARKS[t]; el.classList.add("mark"); return; }
    el.textContent = t;
    if (t.length > 3) el.classList.add(t.length > 4 ? "xlong" : "long");
    const img = new Image();
    img.alt = "";
    img.onload = () => el.appendChild(img);
    img.src = "assets/logos/" + t.toLowerCase() + ".png";
  });

  // Seeded random walk so the charts look the same on every load.
  function walk(seed, n, drift, vol) {
    let s = seed, v = 0;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const pts = [];
    for (let i = 0; i < n; i++) {
      v += drift + (rnd() - 0.5) * vol;
      pts.push(v);
    }
    return pts;
  }

  function toPath(pts, w, h, pad) {
    const min = Math.min(...pts), max = Math.max(...pts);
    const sx = w / (pts.length - 1);
    const sy = (h - pad * 2) / (max - min || 1);
    return pts.map((p, i) => (i ? "L" : "M") + (i * sx).toFixed(1) + " " + (h - pad - (p - min) * sy).toFixed(1)).join(" ");
  }

  // Balance charts (hero and docs): line, glow fill under it, and a live dot at the end.
  document.querySelectorAll("#heroChart, .doc-chart").forEach((svg, n) => {
    const pts = walk(+(svg.dataset.seed || 7), 90, 0.18, 4.2);
    const d = toPath(pts, 290, 170, 12);
    const end = d.slice(d.lastIndexOf("L") + 1).split(" ").map(Number);
    const id = "hg" + n;
    svg.innerHTML =
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#2f7bff" stop-opacity=".45"/><stop offset="1" stop-color="#2f7bff" stop-opacity="0"/>' +
      "</linearGradient></defs>" +
      '<path d="' + d + " L290 170 L0 170 Z" + '" fill="url(#' + id + ')"/>' +
      '<path class="line" d="' + d + '"/>' +
      '<circle cx="' + end[0] + '" cy="' + end[1] + '" r="4" fill="#9cc7ff"/>';
  });

  // Small sparklines: red ones trend down, blue ones trend up.
  document.querySelectorAll(".spark").forEach((svg, i) => {
    const up = svg.classList.contains("up-l");
    const pts = walk(31 + i * 17, 50, up ? 0.25 : -0.05, 5);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.innerHTML = '<path d="' + toPath(pts, 100, +svg.viewBox.baseVal.height, 3) + '"/>';
  });

  // Feed marquee. Every account here is made up, and so is every avatar:
  // small hand-drawn SVGs, a few illustrated people and a few outlet logos.
  const V = (inner) => '<svg viewBox="0 0 64 64" aria-hidden="true">' + inner + "</svg>";
  const person = (bg, skin, hair, shirt, style) => V(
    '<rect width="64" height="64" fill="' + bg + '"/>' +
    '<path d="M6 64c2-12 13-17 26-17s24 5 26 17z" fill="' + shirt + '"/>' +
    '<rect x="27" y="36" width="10" height="12" rx="4" fill="' + skin + '" opacity=".85"/>' +
    '<ellipse cx="32" cy="28" rx="11" ry="13" fill="' + skin + '"/>' +
    ({
      short: '<path d="M20.5 26c-.5-9 5-14 11.5-14s12 4.5 11.5 14c-2-5-6-7.5-11.5-7.5S22.5 21 20.5 26z" fill="' + hair + '"/>',
      curly: '<g fill="' + hair + '"><circle cx="22" cy="21" r="5"/><circle cx="27" cy="15.5" r="5.5"/><circle cx="34" cy="14.5" r="5.5"/><circle cx="40.5" cy="18.5" r="5"/><circle cx="43" cy="25" r="3.5"/><circle cx="21" cy="27" r="3.5"/></g>',
      long: '<path d="M19 44c-1-12-2-32 13-32s14 20 13 32c-2-8-3-15-4-20-4 3-10 4-17 3-1 5-2 10-5 17z" fill="' + hair + '"/>',
      bald: '<path d="M21 27c0-2 .5-3.5 1-4.5 1 1.5 1 3 1 4.5zM43 27c0-2-.5-3.5-1-4.5-1 1.5-1 3-1 4.5z" fill="' + hair + '"/>'
    })[style] +
    '<circle cx="27.5" cy="29" r="1.4" fill="#1b1b1f"/><circle cx="36.5" cy="29" r="1.4" fill="#1b1b1f"/>' +
    '<path d="M28.5 35c2 1.6 5 1.6 7 0" fill="none" stroke="#1b1b1f" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>'
  );
  const av = {
    tapereader: person("#6f7f96", "#e9c3a4", "#3b2a20", "#1d2b44", "short"),
    orbitweekly: V('<rect width="64" height="64" fill="#050608"/><circle cx="32" cy="32" r="11" fill="#e9eef7"/>' +
      '<ellipse cx="32" cy="32" rx="22" ry="7" fill="none" stroke="#5aa2ff" stroke-width="3" transform="rotate(-20 32 32)"/>' +
      '<path d="M21 32a11 11 0 0 0 22 0" fill="#e9eef7"/>'),
    chainside: V('<rect width="64" height="64" fill="#12151b"/><g fill="none" stroke="#fff" stroke-width="4">' +
      '<rect x="12" y="24" width="24" height="16" rx="8"/><rect x="28" y="24" width="24" height="16" rx="8" stroke="#5aa2ff"/></g>'),
    pharmadesk: V('<rect width="64" height="64" fill="#f4f6f9"/><g transform="rotate(-40 32 32)">' +
      '<path d="M20 32a8 8 0 0 1 8-8h4v16h-4a8 8 0 0 1-8-8z" fill="#e5484d"/><path d="M32 24h4a8 8 0 0 1 0 16h-4z" fill="#2f7bff"/></g>'),
    macropulse: V('<rect width="64" height="64" fill="#0f3d2a"/><polyline points="10,34 22,34 27,22 34,44 39,30 42,34 54,34" fill="none" stroke="#7ef0b4" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>'),
    oddflows: V('<rect width="64" height="64" fill="#d9ecff"/><path d="M12 38c0-9 9-14 19-14 9 0 15 5 17 11l6-6-1 13c-6 5-13 6-22 6-11 0-19-3-19-10z" fill="#2f6fd6"/>' +
      '<circle cx="24" cy="34" r="1.8" fill="#fff"/><path d="M30 22c0-4-3-6-3-9M30 22c0-4 3-6 3-9" fill="none" stroke="#5aa2ff" stroke-width="2.2" stroke-linecap="round"/>'),
    wirewatch: V('<rect width="64" height="64" fill="#10b35c"/><path d="M36 10 18 36h12l-4 18 20-28H34z" fill="#06140c"/>'),
    devdiaries: person("#c97d4e", "#8d5a3b", "#1a1210", "#f2f2f2", "curly"),
    energytape: V('<rect width="64" height="64" fill="#1c1c1f"/><path d="M32 12c8 11 14 18 14 26a14 14 0 0 1-28 0c0-8 6-15 14-26z" fill="#f59e0b"/><path d="M32 30c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z" fill="#fde68a"/>'),
    ratedesk: person("#9aa7c7", "#f1d2bd", "#b9793f", "#2f4f8f", "long"),
  };
  const posts = [
    ["Tape Reader", "tapereader", "Retail allocation for the upcoming launch IPO could reach 30%, according to people familiar with the plans."],
    ["Orbit Weekly", "orbitweekly", "Regulator clears direct-to-device satellite broadband, opening the door to coast-to-coast coverage."],
    ["Chainside", "chainside", "Tokenized equities on our chain passed $1b in weekly volume. Memecoins still work fine too."],
    ["Pharma Desk", "pharmadesk", "BREAKING: advisory panel votes in favor of the new peptide therapy; shares halted."],
    ["Macro Pulse", "macropulse", "BREAKING: producer prices cool to 2.1%, below expectations. Futures jump."],
    ["Odd Flows", "oddflows", "Unusual call volume in the chip names ahead of tomorrow's policy decision."],
    ["Wire Watch", "wirewatch", "JUST IN: regulators draft framework to allow on-chain settlement of listed stocks."],
    ["Dev Diaries", "devdiaries", "$540M in protocol deposits three weeks after launch. We're just getting started."],
    ["Energy Tape", "energytape", "Crude reverses 3% intraday after surprise inventory draw."],
    ["Rate Desk", "ratedesk", "Two-year yields fall to a six-month low as traders price in an earlier cut."],
  ];
  const check = '<svg class="ck" viewBox="0 0 24 24"><path d="M12 1l2.6 2.2 3.4-.4 1 3.3 3 1.7-1 3.2 1 3.2-3 1.7-1 3.3-3.4-.4L12 23l-2.6-2.2-3.4.4-1-3.3-3-1.7 1-3.2-1-3.2 3-1.7 1-3.3 3.4.4z"/><path d="M7.5 12.2l3 3 6-6" fill="none" stroke="#fff" stroke-width="2.2"/></svg>';
  const card = (p) =>
    '<article class="post"><span class="pfp">' + av[p[1]] + "</span>" +
    '<div><div class="post-h"><b>' + p[0] + "</b>" + check + "<span>@" + p[1] + "</span></div><p>" + p[2] + "</p></div></article>";

  document.querySelectorAll(".feed-row").forEach((row, r) => {
    const list = r ? posts.slice(5).concat(posts.slice(0, 5)) : posts;
    const html = list.map(card).join("");
    row.innerHTML = html + html; // doubled so the loop is seamless
  });

  // Light up cards on the right half of the screen, where the blue wedge is.
  const allPosts = document.querySelectorAll(".post");
  function highlight() {
    const mid = window.innerWidth * 0.66;
    allPosts.forEach((el) => {
      const r = el.getBoundingClientRect();
      el.classList.toggle("hot", r.left + r.width / 2 > mid);
    });
    requestAnimationFrame(highlight);
  }
  requestAnimationFrame(highlight);

  // Prompt bubbles: one at a time turns blue.
  const bubbles = document.querySelectorAll(".bubble");
  let on = 0;
  if (bubbles.length) {
    bubbles[0].classList.add("on");
    setInterval(() => {
      bubbles[on].classList.remove("on");
      on = (on + 1) % bubbles.length;
      bubbles[on].classList.add("on");
    }, 1800);
  }

  // Hub wiring: curved connectors from each feature to the centre tile.
  const hub = document.getElementById("hub");
  const wires = document.getElementById("wires");
  function wire() {
    if (!hub || !wires || getComputedStyle(wires).display === "none") return;
    const box = hub.getBoundingClientRect();
    const core = hub.querySelector(".core-tile").getBoundingClientRect();
    const cy = core.top + core.height / 2 - box.top;
    let out = "";
    hub.querySelectorAll(".node").forEach((n) => {
      const r = n.getBoundingClientRect();
      const left = n.dataset.side === "l";
      const x1 = (left ? r.right : r.left) - box.left;
      const y1 = r.top + r.height / 2 - box.top;
      const x2 = (left ? core.left : core.right) - box.left;
      const mx = (x1 + x2) / 2;
      const d = "M" + x1 + " " + y1 + " C" + mx + " " + y1 + " " + mx + " " + cy + " " + x2 + " " + cy;
      out += '<path d="' + d + '"/><path class="flow" d="' + d + '" style="animation-delay:' + (-Math.random() * 3.5).toFixed(2) + 's"/>';
    });
    wires.innerHTML = out;
  }
  window.addEventListener("resize", wire);
  document.fonts ? document.fonts.ready.then(wire) : window.addEventListener("load", wire);
  wire();

  // Terms gate: shown until the visitor accepts, then remembered per browser.
  const gate = document.getElementById("gate");
  if (gate) {
    const KEY = "azur-terms-accepted-v1";
    let seen = false;
    try { seen = localStorage.getItem(KEY) === "1"; } catch (e) {}
    const boxes = [...gate.querySelectorAll("input[type=checkbox]")];
    const ok = document.getElementById("gateOk");
    const no = document.getElementById("gateNo");
    const note = document.getElementById("gateNote");
    if (!seen) {
      gate.hidden = false;
      document.body.classList.add("gated");
      boxes[0].focus({ preventScroll: true });
    }
    const update = () => { ok.disabled = !boxes.every((b) => b.checked); };
    boxes.forEach((b) => b.addEventListener("change", () => { update(); note.hidden = true; }));
    no.addEventListener("click", () => { note.hidden = false; });
    ok.addEventListener("click", () => {
      try { localStorage.setItem(KEY, "1"); } catch (e) {}
      gate.classList.add("out");
      setTimeout(() => {
        gate.hidden = true;
        document.body.classList.remove("gated");
      }, 200);
    });
    // keep keyboard focus inside the dialog while it is open
    gate.addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const f = [...gate.querySelectorAll("input, a, button:not(:disabled)")];
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    update();
  }
})();
