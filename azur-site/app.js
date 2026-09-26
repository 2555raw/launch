// AZUR — charts, feed marquee, cycling prompt bubbles and hub wiring.
(function () {
  "use strict";

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

  // Hero balance chart: line, glow fill under it, and a live dot at the end.
  const hero = document.getElementById("heroChart");
  if (hero) {
    const pts = walk(7, 90, 0.18, 4.2);
    const d = toPath(pts, 290, 170, 12);
    const end = d.slice(d.lastIndexOf("L") + 1).split(" ").map(Number);
    hero.innerHTML =
      '<defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#2f7bff" stop-opacity=".45"/><stop offset="1" stop-color="#2f7bff" stop-opacity="0"/>' +
      "</linearGradient></defs>" +
      '<path d="' + d + " L290 170 L0 170 Z" + '" fill="url(#hg)"/>' +
      '<path class="line" d="' + d + '"/>' +
      '<circle cx="' + end[0] + '" cy="' + end[1] + '" r="4" fill="#9cc7ff"/>';
  }

  // Small sparklines: red ones trend down, blue ones trend up.
  document.querySelectorAll(".spark").forEach((svg, i) => {
    const up = svg.classList.contains("up-l");
    const pts = walk(31 + i * 17, 50, up ? 0.25 : -0.05, 5);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.innerHTML = '<path d="' + toPath(pts, 100, +svg.viewBox.baseVal.height, 3) + '"/>';
  });

  // Feed marquee. Every account here is made up.
  const posts = [
    ["Tape Reader", "tapereader", "#1f3a68", "TR", "Retail allocation for the upcoming launch IPO could reach 30%, according to people familiar with the plans."],
    ["Orbit Weekly", "orbitweekly", "#0b0b0b", "OW", "Regulator clears direct-to-device satellite broadband, opening the door to coast-to-coast coverage."],
    ["Chainside", "chainside", "#20242c", "CS", "Tokenized equities on our chain passed $1b in weekly volume. Memecoins still work fine too."],
    ["Pharma Desk", "pharmadesk", "#f2f4f7", "Rx", "BREAKING: advisory panel votes in favor of the new peptide therapy; shares halted."],
    ["Macro Pulse", "macropulse", "#0f5132", "MP", "BREAKING: producer prices cool to 2.1%, below expectations. Futures jump."],
    ["Odd Flows", "oddflows", "#154a8a", "OF", "Unusual call volume in the chip names ahead of tomorrow's policy decision."],
    ["Wire Watch", "wirewatch", "#12a150", "WW", "JUST IN: regulators draft framework to allow on-chain settlement of listed stocks."],
    ["Dev Diaries", "devdiaries", "#6b3fa0", "DD", "$540M in protocol deposits three weeks after launch. We're just getting started."],
    ["Energy Tape", "energytape", "#a8541b", "ET", "Crude reverses 3% intraday after surprise inventory draw."],
    ["Rate Desk", "ratedesk", "#2f4f8f", "RD", "Two-year yields fall to a six-month low as traders price in an earlier cut."],
  ];
  const check = '<svg class="ck" viewBox="0 0 24 24"><path d="M12 1l2.6 2.2 3.4-.4 1 3.3 3 1.7-1 3.2 1 3.2-3 1.7-1 3.3-3.4-.4L12 23l-2.6-2.2-3.4.4-1-3.3-3-1.7 1-3.2-1-3.2 3-1.7 1-3.3 3.4.4z"/><path d="M7.5 12.2l3 3 6-6" fill="none" stroke="#fff" stroke-width="2.2"/></svg>';
  const card = (p) =>
    '<article class="post"><span class="pfp" style="background:' + p[2] + ";color:" + (p[2] === "#f2f4f7" ? "#111" : "#fff") + '">' + p[3] + "</span>" +
    '<div><div class="post-h"><b>' + p[0] + "</b>" + check + "<span>@" + p[1] + "</span></div><p>" + p[4] + "</p></div></article>";

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
})();
